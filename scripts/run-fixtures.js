#!/usr/bin/env node

/**
 * Lightweight fixture runner:
 *  - walks test directories for .pyc files
 *  - decompiles them in-process
 *  - compares with expected .py if present
 *
 * Usage examples:
 *   node scripts/run-fixtures.js --pattern 3.8
 *   node scripts/run-fixtures.js --limit 20 --fail-fast
 */

const fs = require('fs');
const path = require('path');
const {PycReader} = require('../lib/PycReader');
const PycDecompiler = require('../lib/PycDecompiler');

// Keep debug off by default; can be toggled with --debug.
global.g_cliArgs = {
    debug: false
};

function parseArgs() {
    const args = {
        root: 'test',
        pattern: '',
        limit: 0,
        failFast: false,
        debug: false
    };

    for (let idx = 2; idx < process.argv.length; idx++) {
        const arg = process.argv[idx];
        if (arg === '--root' && process.argv[idx + 1]) {
            args.root = process.argv[++idx];
        } else if (arg === '--pattern' && process.argv[idx + 1]) {
            args.pattern = process.argv[++idx];
        } else if (arg === '--limit' && process.argv[idx + 1]) {
            args.limit = parseInt(process.argv[++idx], 10) || 0;
        } else if (arg === '--fail-fast') {
            args.failFast = true;
        } else if (arg === '--debug') {
            args.debug = true;
        }
    }

    return args;
}

function* walkDir(dirPath) {
    const entries = fs.readdirSync(dirPath, {withFileTypes: true});
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            yield* walkDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.pyc')) {
            yield fullPath;
        }
    }
}

function* walkDirForPy(dirPath) {
    const entries = fs.readdirSync(dirPath, {withFileTypes: true});
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            yield* walkDirForPy(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.py')) {
            yield fullPath;
        }
    }
}

function findExpectedFile(pycPath) {
    const base = path.basename(pycPath, '.pyc');
    const dir = path.dirname(pycPath);

    // Direct sibling: <dir>/decompiled/<name>.py
    const direct = path.join(dir, 'decompiled', `${base}.py`);
    if (fs.existsSync(direct)) {
        return direct;
    }

    // Deep search under decompiled/ for matching filename.
    const decompiledRoot = path.join(dir, 'decompiled');
    if (!fs.existsSync(decompiledRoot)) {
        return null;
    }

    for (const candidate of walkDirForPy(decompiledRoot)) {
        if (path.basename(candidate, '.py') === base) {
            return candidate;
        }
    }

    return null;
}

function normalizeSource(src) {
    return src.replace(/\r\n/g, '\n').trim();
}

function decompilePyc(pycPath) {
    const buffer = fs.readFileSync(pycPath);
    const reader = new PycReader(buffer);
    const obj = reader.ReadObject();
    const decompiler = new PycDecompiler(obj);
    const ast = decompiler.decompile();
    const result = ast.codeFragment();
    return result.toString();
}

function main() {
    const args = parseArgs();
    global.g_cliArgs.debug = !!args.debug;

    if (!fs.existsSync(args.root)) {
        console.error(`Root directory "${args.root}" not found`);
        process.exit(1);
    }

    const stats = {
        total: 0,
        decompiled: 0,
        passed: 0,
        failed: 0,
        missingExpected: 0,
        errored: 0
    };

    const failures = [];
    const start = Date.now();

    for (const pycPath of walkDir(args.root)) {
        if (args.pattern && !pycPath.includes(args.pattern)) {
            continue;
        }
        if (args.limit && stats.total >= args.limit) {
            break;
        }
        stats.total++;

        let pySource;
        try {
            pySource = decompilePyc(pycPath);
            stats.decompiled++;
        } catch (err) {
            stats.errored++;
            failures.push({file: pycPath, reason: `decompile error: ${err.message}`});
            if (args.failFast) {
                break;
            }
            continue;
        }

        const expectedPath = findExpectedFile(pycPath);
        if (!expectedPath) {
            stats.missingExpected++;
            continue;
        }

        const expectedSource = fs.readFileSync(expectedPath, 'utf8');
        if (normalizeSource(expectedSource) === normalizeSource(pySource)) {
            stats.passed++;
        } else {
            stats.failed++;
            failures.push({file: pycPath, reason: `differs from ${expectedPath}`});
            if (args.failFast) {
                break;
            }
        }
    }

    const durationMs = Date.now() - start;
    console.log(`Fixtures scanned: ${stats.total}, decompiled: ${stats.decompiled}`);
    console.log(`Passed: ${stats.passed}, Failed: ${stats.failed}, Missing expected: ${stats.missingExpected}, Errors: ${stats.errored}`);
    console.log(`Elapsed: ${(durationMs / 1000).toFixed(2)}s`);

    if (failures.length > 0) {
        console.log('Failures:');
        for (const fail of failures) {
            console.log(` - ${fail.file}: ${fail.reason}`);
        }
        process.exitCode = 1;
    }
}

main();
