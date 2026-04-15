#!/usr/bin/env node

/**
 * Gate: decompiler output must not contain sentinel markers that leak from
 * fallback code paths. These strings only appear when a handler hits an
 * unresolved case and emits a placeholder instead of throwing.
 *
 * Sentinel catalogue:
 *   `###FIXME###`         — missing node name in context/except handlers
 *   `##ERROR_DECORATOR##` — decorator expression didn't resolve
 *   `#TODO ASTClass`      — class decorator AST fallback
 *   `#TODO pattern`       — unhandled match-pattern type
 *   `#TODO <ClassName>`   — default ASTNode.codeFragment fallback
 *
 * Scope: every `.py` under `test/bytecode_*&#47;decompiled/`. A baseline file
 * can whitelist known-violating paths during transition.
 *
 * Usage:
 *   node scripts/check-no-sentinels.js
 *   node scripts/check-no-sentinels.js --baseline scripts/baselines/sentinels.txt
 *   node scripts/check-no-sentinels.js --update-baseline --baseline FILE
 *
 * Exit codes:
 *   0 — no new sentinels
 *   1 — new sentinel leaks found
 */

const fs = require('fs');
const path = require('path');

const SENTINELS = [
    {name: '###FIXME###', regex: /###FIXME###/},
    {name: '##ERROR_DECORATOR##', regex: /##ERROR_DECORATOR##/},
    {name: '#TODO pattern', regex: /#TODO pattern\b/},
    // `#TODO <ClassName>` — catches ASTNode default fallback AND ASTClass fallback.
    {name: '#TODO <Class>', regex: /#TODO [A-Z][A-Za-z_0-9]+/}
];

function parseArgs() {
    const args = {roots: [], baseline: null, updateBaseline: false, quiet: false};
    for (let i = 2; i < process.argv.length; i++) {
        const a = process.argv[i];
        if (a === '--root' && process.argv[i + 1]) args.roots.push(process.argv[++i]);
        else if (a === '--baseline' && process.argv[i + 1]) args.baseline = process.argv[++i];
        else if (a === '--update-baseline') args.updateBaseline = true;
        else if (a === '--quiet') args.quiet = true;
        else if (a === '-h' || a === '--help') {
            console.log('Usage: check-no-sentinels.js [--root DIR]... [--baseline FILE] [--update-baseline] [--quiet]');
            process.exit(0);
        }
    }
    if (args.roots.length === 0) {
        const testDir = path.join(__dirname, '..', 'test');
        if (fs.existsSync(testDir)) {
            for (const entry of fs.readdirSync(testDir)) {
                if (/^bytecode_/.test(entry)) args.roots.push(path.join('test', entry));
            }
        }
    }
    return args;
}

function* walkDecompiledPy(root) {
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
            } else if (e.isFile() && e.name.endsWith('.py') &&
                       full.split(path.sep).includes('decompiled')) {
                yield full;
            }
        }
    }
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
        '# check-no-sentinels baseline — decompiled fixtures that currently leak',
        '# sentinel markers (###FIXME###, ##ERROR_DECORATOR##, #TODO ...).',
        '# Fix the bug in lib/ and remove the entry — do not pad this file.',
        ''
    ].join('\n');
    const body = [...paths].sort().join('\n') + '\n';
    fs.writeFileSync(file, header + body);
}

function scanFile(p) {
    const src = fs.readFileSync(p, 'utf8');
    const hits = [];
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const s of SENTINELS) {
            if (s.regex.test(line)) {
                hits.push({line: i + 1, marker: s.name, text: line.trim().slice(0, 200)});
            }
        }
    }
    return hits;
}

function main() {
    const args = parseArgs();
    const baseline = loadBaseline(args.baseline);
    const violators = new Map(); // relPath → [hit...]

    for (const root of args.roots) {
        if (!fs.existsSync(root)) continue;
        for (const f of walkDecompiledPy(root)) {
            const hits = scanFile(f);
            if (hits.length > 0) {
                violators.set(path.relative(process.cwd(), f), hits);
            }
        }
    }

    const violatorPaths = [...violators.keys()];
    const newViolators = violatorPaths.filter(p => !baseline.has(p));
    const fixed = [...baseline].filter(b => !violators.has(b));

    if (args.updateBaseline && args.baseline) {
        writeBaseline(args.baseline, violatorPaths);
        console.log(`Baseline updated: ${args.baseline} (${violatorPaths.length} entries)`);
    }

    if (!args.quiet) {
        if (newViolators.length > 0) {
            console.log(`\nNEW sentinel leaks (${newViolators.length}):`);
            for (const p of newViolators) {
                for (const h of violators.get(p)) {
                    console.log(`  ${p}:${h.line}  [${h.marker}]  ${h.text}`);
                }
            }
        }
        if (fixed.length > 0) {
            console.log(`\nBaselined paths now CLEAN (${fixed.length}) — remove from baseline:`);
            for (const p of fixed) console.log(`  ${p}`);
        }
    }

    console.log(`\nScanned roots: ${args.roots.length}  Violators: ${violatorPaths.length}  New: ${newViolators.length}  Baselined: ${violatorPaths.length - newViolators.length}`);

    if (newViolators.length > 0) process.exit(1);
    process.exit(0);
}

main();
