#!/usr/bin/env node

/**
 * Marshal fixture runner:
 *  - walks test/marshal for .marshal files
 *  - decompiles them via depyo CLI in --marshal mode
 *  - compares with expected .py if present
 *
 * Usage examples:
 *   node scripts/run-marshal-fixtures.js --pattern py311
 *   node scripts/run-marshal-fixtures.js --py-version 3.11 --fail-fast
 */

const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

function parseArgs() {
    const args = {
        root: 'test/marshal',
        pattern: '',
        limit: 0,
        failFast: false,
        strict: false,      // Strict comparison (no comment/whitespace normalization)
        showDiff: false,    // Show diff on failure
        pyVersion: null
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
        } else if (arg === '--strict') {
            args.strict = true;
        } else if (arg === '--show-diff') {
            args.showDiff = true;
        } else if (arg === '--py-version' && process.argv[idx + 1]) {
            args.pyVersion = process.argv[++idx];
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
        } else if (entry.isFile() && entry.name.endsWith('.marshal')) {
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

function findExpectedFile(marshalPath) {
    const base = path.basename(marshalPath, '.marshal');
    const dir = path.dirname(marshalPath);

    const direct = path.join(dir, 'decompiled', `${base}.py`);
    if (fs.existsSync(direct)) {
        return direct;
    }

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

function normalizeSource(src, strict = false) {
    let normalized = src
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (!strict) {
        normalized = normalized
            .replace(/#[^\n]*$/gm, '')
            .replace(/[ \t]+$/gm, '')
            .trim();
    }

    return normalized;
}

function decompileMarshal(marshalPath, args) {
    const cmd = ['depyo.js', '--marshal', '--out'];
    const versionHint = args.pyVersion || inferVersionHint(marshalPath);
    if (versionHint) {
        cmd.push('--py-version', versionHint);
    }
    cmd.push(marshalPath);

    return execFileSync('node', cmd, {encoding: 'utf8'});
}

function inferVersionHint(marshalPath) {
    const match = marshalPath.match(/bytecode_(\d+\.\d+)/);
    return match ? match[1] : null;
}

function main() {
    const args = parseArgs();

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

    for (const marshalPath of walkDir(args.root)) {
        if (args.pattern && !marshalPath.includes(args.pattern)) {
            continue;
        }
        if (args.limit && stats.total >= args.limit) {
            break;
        }
        stats.total++;

        let pySource;
        try {
            pySource = decompileMarshal(marshalPath, args);
            stats.decompiled++;
        } catch (err) {
            stats.errored++;
            failures.push({file: marshalPath, reason: `decompile error: ${err.message}`});
            if (args.failFast) {
                break;
            }
            continue;
        }

        const expectedPath = findExpectedFile(marshalPath);
        if (!expectedPath) {
            stats.missingExpected++;
            continue;
        }

        const expectedSource = fs.readFileSync(expectedPath, 'utf8');
        const normalizedExpected = normalizeSource(expectedSource, args.strict);
        const normalizedActual = normalizeSource(pySource, args.strict);

        if (normalizedExpected === normalizedActual) {
            stats.passed++;
        } else {
            stats.failed++;
            let reason = `differs from ${expectedPath}`;
            if (args.showDiff) {
                const expectedLines = normalizedExpected.split('\n');
                const actualLines = normalizedActual.split('\n');
                const diffLines = [];
                const maxLines = Math.max(expectedLines.length, actualLines.length);
                for (let i = 0; i < maxLines; i++) {
                    if (expectedLines[i] !== actualLines[i]) {
                        diffLines.push(`  Line ${i + 1}:`);
                        if (expectedLines[i] !== undefined) {
                            diffLines.push(`    - ${expectedLines[i]}`);
                        }
                        if (actualLines[i] !== undefined) {
                            diffLines.push(`    + ${actualLines[i]}`);
                        }
                    }
                }
                if (diffLines.length > 10) {
                    diffLines.length = 10;
                    diffLines.push('  ...');
                }
                reason += `\n${diffLines.join('\n')}`;
            }
            failures.push({file: marshalPath, reason});
            if (args.failFast) {
                break;
            }
        }
    }

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`Marshal fixtures in ${duration}s`);
    console.log(`Total: ${stats.total}, Decompiled: ${stats.decompiled}, Passed: ${stats.passed}, Failed: ${stats.failed}, Missing expected: ${stats.missingExpected}, Errors: ${stats.errored}`);

    if (failures.length) {
        console.log('\nFailures:');
        for (const failure of failures) {
            console.log(`- ${failure.file}: ${failure.reason}`);
        }
        process.exit(1);
    }
}

main();
