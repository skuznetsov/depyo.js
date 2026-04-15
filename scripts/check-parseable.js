#!/usr/bin/env node

/**
 * Tier-1 correctness oracle: verify every decompiled .py under
 * `test/bytecode_*&#47;decompiled/` parses as valid Python syntax.
 *
 * Why: the fixture suite is a snapshot regression oracle, not a correctness oracle.
 * If decompilation output contains `###FIXME###` or malformed constructs, the snapshot
 * captures the garbage and the test "passes". This script catches syntactic failures.
 *
 * Scope: only `test/bytecode_3.*` trees by default (Python 3 syntax). Python 2
 * fixtures require a different parser and are skipped.
 *
 * Usage:
 *   node scripts/check-parseable.js
 *   node scripts/check-parseable.js --root test/bytecode_3.12
 *   node scripts/check-parseable.js --baseline scripts/parseable-baseline.txt
 *   node scripts/check-parseable.js --python /tmp/cpython-3.15/python.exe
 *
 * Exit codes:
 *   0 — all files parse, or failures are all listed in baseline
 *   1 — new syntax failures not in baseline
 *   2 — Python interpreter missing / script error
 */

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

function parseArgs() {
    const args = {
        roots: [],
        python: null,
        baseline: null,
        updateBaseline: false,
        quiet: false
    };
    for (let i = 2; i < process.argv.length; i++) {
        const a = process.argv[i];
        if (a === '--root' && process.argv[i + 1]) {
            args.roots.push(process.argv[++i]);
        } else if (a === '--python' && process.argv[i + 1]) {
            args.python = process.argv[++i];
        } else if (a === '--baseline' && process.argv[i + 1]) {
            args.baseline = process.argv[++i];
        } else if (a === '--update-baseline') {
            args.updateBaseline = true;
        } else if (a === '--quiet') {
            args.quiet = true;
        } else if (a === '-h' || a === '--help') {
            console.log('Usage: check-parseable.js [--root DIR]... [--python PATH] [--baseline FILE] [--update-baseline] [--quiet]');
            process.exit(0);
        }
    }
    if (args.roots.length === 0) {
        // Default: every bytecode_3.* test tree at repo root.
        const testDir = path.join(__dirname, '..', 'test');
        if (fs.existsSync(testDir)) {
            for (const entry of fs.readdirSync(testDir)) {
                if (/^bytecode_3\./.test(entry)) {
                    args.roots.push(path.join('test', entry));
                }
            }
        }
    }
    return args;
}

function findPython(explicit) {
    if (explicit) {
        if (!fs.existsSync(explicit)) {
            console.error(`Python binary not found: ${explicit}`);
            process.exit(2);
        }
        return explicit;
    }
    // Prefer newest available: locally-built 3.15 > system python3.
    const candidates = [
        '/tmp/cpython-3.15/python.exe',
        'python3.15',
        'python3.14',
        'python3'
    ];
    for (const c of candidates) {
        const r = spawnSync(c, ['--version'], {encoding: 'utf8'});
        if (r.status === 0 || r.stdout?.startsWith('Python ')) {
            return c;
        }
    }
    console.error('No Python interpreter found; tried:', candidates.join(', '));
    process.exit(2);
}

function* walkDecompiledPy(root) {
    const stack = [root];
    while (stack.length) {
        const cur = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(cur, {withFileTypes: true});
        } catch {
            continue;
        }
        for (const e of entries) {
            const full = path.join(cur, e.name);
            if (e.isDirectory()) {
                stack.push(full);
            } else if (e.isFile() && e.name.endsWith('.py')) {
                // Only decompiled outputs live under a "decompiled" ancestor.
                if (full.split(path.sep).includes('decompiled')) {
                    yield full;
                }
            }
        }
    }
}

function loadBaseline(baselineFile) {
    if (!baselineFile || !fs.existsSync(baselineFile)) return new Set();
    const set = new Set();
    for (const line of fs.readFileSync(baselineFile, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        set.add(trimmed);
    }
    return set;
}

function writeBaseline(baselineFile, paths) {
    const header = [
        '# check-parseable baseline — paths currently failing Python syntax check.',
        '# Regenerate with: node scripts/check-parseable.js --update-baseline',
        '# Fix the bug that produces the failure and remove the entry.',
        ''
    ].join('\n');
    const body = [...paths].sort().join('\n') + '\n';
    fs.writeFileSync(baselineFile, header + body);
}

function main() {
    const args = parseArgs();
    const python = findPython(args.python);

    const files = [];
    for (const root of args.roots) {
        if (!fs.existsSync(root)) {
            console.error(`Root not found: ${root}`);
            process.exit(2);
        }
        for (const f of walkDecompiledPy(root)) {
            files.push(path.relative(process.cwd(), f));
        }
    }

    if (files.length === 0) {
        console.log('No decompiled .py files found.');
        process.exit(0);
    }

    // Single Python subprocess parses all files. Reads paths from stdin, emits
    // one `path|OK` or `path|FAIL|line|col|msg` line per input.
    const pyScript = `
import ast, sys
for line in sys.stdin:
    p = line.rstrip('\\n')
    if not p: continue
    try:
        with open(p, 'rb') as f:
            src = f.read()
        ast.parse(src, filename=p)
        print(p + '|OK', flush=False)
    except SyntaxError as e:
        msg = (e.msg or '').replace('|', '/')
        print(f"{p}|FAIL|{e.lineno or 0}|{e.offset or 0}|{msg}", flush=False)
    except Exception as e:
        msg = str(e).replace('|', '/')
        print(f"{p}|ERROR|0|0|{type(e).__name__}: {msg}", flush=False)
`;

    const started = Date.now();
    const proc = spawnSync(python, ['-c', pyScript], {
        input: files.join('\n'),
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });

    if (proc.status !== 0 && !proc.stdout) {
        console.error('Python subprocess failed:');
        console.error(proc.stderr || proc.error?.message);
        process.exit(2);
    }

    const baseline = loadBaseline(args.baseline);
    const passed = [];
    const failed = [];        // new failures (not in baseline)
    const baselined = [];     // known failures still failing
    const fixed = new Set([...baseline]); // will shrink as we see still-failing baselined

    for (const line of proc.stdout.split('\n')) {
        if (!line) continue;
        const parts = line.split('|');
        const p = parts[0];
        const status = parts[1];
        if (status === 'OK') {
            passed.push(p);
        } else {
            const detail = {path: p, status, lineno: parts[2], col: parts[3], msg: parts.slice(4).join('|')};
            if (baseline.has(p)) {
                baselined.push(detail);
                fixed.delete(p);
            } else {
                failed.push(detail);
            }
        }
    }

    const elapsed = ((Date.now() - started) / 1000).toFixed(2);

    if (args.updateBaseline && args.baseline) {
        const allFailing = [...failed.map(f => f.path), ...baselined.map(f => f.path)];
        writeBaseline(args.baseline, allFailing);
        console.log(`Baseline updated: ${args.baseline} (${allFailing.length} entries)`);
    }

    if (!args.quiet) {
        if (failed.length > 0) {
            console.log(`\nNEW syntax failures (${failed.length}):`);
            for (const f of failed) {
                console.log(`  ${f.path}:${f.lineno}:${f.col}  ${f.msg}`);
            }
        }
        if (fixed.size > 0) {
            console.log(`\nBaselined entries that NOW PASS (${fixed.size}) — remove from baseline:`);
            for (const p of fixed) console.log(`  ${p}`);
        }
    }

    const total = passed.length + failed.length + baselined.length;
    console.log(`\nChecked: ${total}  Passed: ${passed.length}  Failed: ${failed.length}  Baselined: ${baselined.length}  Elapsed: ${elapsed}s  Python: ${python}`);

    if (failed.length > 0) process.exit(1);
    if (fixed.size > 0 && !args.updateBaseline) {
        console.log('\nHint: pass --update-baseline to regenerate, since some baselined entries now pass.');
    }
    process.exit(0);
}

main();
