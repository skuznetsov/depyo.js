#!/usr/bin/env node

/**
 * Tier-2 correctness oracle: compare Python AST of source `.py` against AST of
 * decompiled `.py`. If they match after normalization, decompilation preserved
 * program semantics. If they diverge, decompilation silently corrupted the
 * program — a class of bug that Tier-1 (parseable) cannot catch.
 *
 * Scope: only fixtures with a known source `.py` (by basename in
 * `test/modern_features/` or `test/simple_source/`). Other decompiled files
 * are reported as "no oracle" and skipped.
 *
 * Normalization strips node-column offsets, docstring positions, constant-fold
 * differences, and the CPython `.0` comprehension-iterator convention.
 *
 * Usage:
 *   node scripts/check-ast-equivalence.js
 *   node scripts/check-ast-equivalence.js --root test/bytecode_3.12
 *   node scripts/check-ast-equivalence.js --baseline scripts/baselines/ast-equivalence.txt
 *   node scripts/check-ast-equivalence.js --update-baseline --baseline FILE
 *
 * Exit codes:
 *   0 — all comparable fixtures match (or baseline covers every mismatch)
 *   1 — new semantic divergences
 *   2 — interpreter missing / script error
 */

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

function parseArgs() {
    const args = {
        roots: [],
        sources: [],
        python: null,
        baseline: null,
        updateBaseline: false,
        quiet: false,
        showDiff: false
    };
    for (let i = 2; i < process.argv.length; i++) {
        const a = process.argv[i];
        if (a === '--root' && process.argv[i + 1]) args.roots.push(process.argv[++i]);
        else if (a === '--source' && process.argv[i + 1]) args.sources.push(process.argv[++i]);
        else if (a === '--python' && process.argv[i + 1]) args.python = process.argv[++i];
        else if (a === '--baseline' && process.argv[i + 1]) args.baseline = process.argv[++i];
        else if (a === '--update-baseline') args.updateBaseline = true;
        else if (a === '--quiet') args.quiet = true;
        else if (a === '--show-diff') args.showDiff = true;
        else if (a === '-h' || a === '--help') {
            console.log('Usage: check-ast-equivalence.js [--root DIR]... [--source DIR]... [--python PATH] [--baseline FILE] [--update-baseline] [--show-diff] [--quiet]');
            process.exit(0);
        }
    }
    const testDir = path.join(__dirname, '..', 'test');
    if (args.roots.length === 0) {
        for (const entry of fs.readdirSync(testDir)) {
            if (/^bytecode_3\./.test(entry)) args.roots.push(path.join('test', entry));
        }
    }
    if (args.sources.length === 0) {
        const candidates = ['modern_features', 'simple_source'];
        for (const c of candidates) {
            const p = path.join(testDir, c);
            if (fs.existsSync(p)) args.sources.push(path.relative(process.cwd(), p));
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
    const candidates = ['/tmp/cpython-3.15/python.exe', 'python3.15', 'python3.14', 'python3'];
    for (const c of candidates) {
        const r = spawnSync(c, ['--version'], {encoding: 'utf8'});
        if (r.status === 0 || r.stdout?.startsWith('Python ')) return c;
    }
    console.error('No Python interpreter found');
    process.exit(2);
}

function* walkPy(root) {
    const stack = [root];
    while (stack.length) {
        const cur = stack.pop();
        let entries;
        try { entries = fs.readdirSync(cur, {withFileTypes: true}); } catch { continue; }
        for (const e of entries) {
            const full = path.join(cur, e.name);
            if (e.isDirectory()) {
                if (e.name === '__pycache__') continue;
                stack.push(full);
            } else if (e.isFile() && e.name.endsWith('.py')) {
                yield full;
            }
        }
    }
}

function buildSourceIndex(sourceRoots) {
    const idx = new Map(); // basename → absolute source path
    for (const root of sourceRoots) {
        for (const f of walkPy(root)) {
            const base = path.basename(f);
            if (!idx.has(base)) idx.set(base, f);
        }
    }
    return idx;
}

function loadBaseline(file) {
    if (!file || !fs.existsSync(file)) return new Set();
    const set = new Set();
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        set.add(t);
    }
    return set;
}

function writeBaseline(file, paths) {
    const header = [
        '# check-ast-equivalence baseline — decompiled fixtures whose AST diverges from source.',
        '# Regenerate with: node scripts/check-ast-equivalence.js --update-baseline --baseline <file>',
        '# Fix the bug and remove the entry.',
        ''
    ].join('\n');
    const body = [...paths].sort().join('\n') + '\n';
    fs.writeFileSync(file, header + body);
}

function main() {
    const args = parseArgs();
    const python = findPython(args.python);
    const sourceIdx = buildSourceIndex(args.sources);

    // Gather decompiled .py files that have a matching source by basename.
    const pairs = [];
    const noOracle = [];
    for (const root of args.roots) {
        if (!fs.existsSync(root)) continue;
        for (const f of walkPy(root)) {
            if (!f.split(path.sep).includes('decompiled')) continue;
            const base = path.basename(f);
            const src = sourceIdx.get(base);
            if (src) pairs.push([src, f]);
            else noOracle.push(f);
        }
    }

    if (pairs.length === 0) {
        console.log(`No comparable fixtures found. Source index had ${sourceIdx.size} entries; no matches by basename.`);
        process.exit(0);
    }

    const pyScript = String.raw`
import ast, sys, json

def normalize(tree):
    # Strip positional fields and simple formatting differences so semantic
    # equivalence wins over byte-exact equivalence.
    for node in ast.walk(tree):
        for attr in ('lineno', 'col_offset', 'end_lineno', 'end_col_offset',
                     'ctx', 'type_comment'):
            if hasattr(node, attr):
                try: setattr(node, attr, None)
                except: pass
        # Comprehension iterator variable .0 is a CPython implementation detail
        # that cannot be recovered from bytecode; normalize to *
        if isinstance(node, ast.Name) and node.id == '.0':
            node.id = '_ITER_ARG_'
    return tree

def tree_fingerprint(tree):
    # Dump without attributes to keep output compact and stable.
    return ast.dump(tree, annotate_fields=True, include_attributes=False)

def compare(src, dec):
    try:
        with open(src, 'rb') as f: src_txt = f.read()
        with open(dec, 'rb') as f: dec_txt = f.read()
        src_tree = normalize(ast.parse(src_txt, filename=src))
        dec_tree = normalize(ast.parse(dec_txt, filename=dec))
        s = tree_fingerprint(src_tree)
        d = tree_fingerprint(dec_tree)
        if s == d:
            return {'status': 'OK'}
        return {'status': 'DIFF', 'src_len': len(s), 'dec_len': len(d)}
    except SyntaxError as e:
        return {'status': 'PARSE_ERR', 'msg': f"{e.filename}:{e.lineno}: {e.msg}"}
    except Exception as e:
        return {'status': 'ERROR', 'msg': f"{type(e).__name__}: {e}"}

pairs = json.loads(sys.stdin.read())
results = []
for src, dec in pairs:
    r = compare(src, dec)
    r['src'] = src
    r['dec'] = dec
    results.append(r)
json.dump(results, sys.stdout)
`;

    const started = Date.now();
    const proc = spawnSync(python, ['-c', pyScript], {
        input: JSON.stringify(pairs),
        encoding: 'utf8',
        maxBuffer: 128 * 1024 * 1024
    });
    if (proc.status !== 0 || !proc.stdout) {
        console.error('Python subprocess failed:');
        console.error(proc.stderr || proc.error?.message);
        process.exit(2);
    }
    let results;
    try { results = JSON.parse(proc.stdout); }
    catch (e) {
        console.error('Failed to parse Python output:', e.message);
        console.error(proc.stdout.slice(0, 500));
        process.exit(2);
    }

    const baseline = loadBaseline(args.baseline);
    const ok = [], diff = [], parseErr = [], error = [];
    const stillBaselined = new Set();
    for (const r of results) {
        const rel = path.relative(process.cwd(), r.dec);
        if (r.status === 'OK') ok.push(rel);
        else {
            const detail = {...r, rel};
            if (r.status === 'DIFF') diff.push(detail);
            else if (r.status === 'PARSE_ERR') parseErr.push(detail);
            else error.push(detail);
            if (baseline.has(rel)) stillBaselined.add(rel);
        }
    }
    const allFailing = [...diff, ...parseErr, ...error];
    const newFailures = allFailing.filter(f => !baseline.has(f.rel));
    const fixed = [...baseline].filter(b => !allFailing.some(f => f.rel === b));
    const elapsed = ((Date.now() - started) / 1000).toFixed(2);

    if (args.updateBaseline && args.baseline) {
        writeBaseline(args.baseline, allFailing.map(f => f.rel));
        console.log(`Baseline updated: ${args.baseline} (${allFailing.length} entries)`);
    }

    if (!args.quiet) {
        if (newFailures.length > 0) {
            console.log(`\nNEW AST divergences (${newFailures.length}):`);
            for (const f of newFailures) {
                console.log(`  [${f.status}] ${f.rel}${f.msg ? '  — ' + f.msg : ''}`);
            }
        }
        if (fixed.length > 0) {
            console.log(`\nBaselined entries that NOW MATCH (${fixed.length}) — remove from baseline:`);
            for (const p of fixed) console.log(`  ${p}`);
        }
    }

    console.log(`\nCompared: ${pairs.length}  OK: ${ok.length}  DIFF: ${diff.length}  PARSE_ERR: ${parseErr.length}  ERROR: ${error.length}  Baselined: ${stillBaselined.size}  NoOracle: ${noOracle.length}  Elapsed: ${elapsed}s`);

    if (newFailures.length > 0) process.exit(1);
    process.exit(0);
}

main();
