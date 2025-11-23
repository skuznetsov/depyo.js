#!/usr/bin/env node

/**
 * Versioned fixture matrix runner.
 * Iterates over bytecode_* directories and runs run-fixtures.js per version.
 *
 * Options:
 *   --include-pypy    Include PyPy bytecode_* dirs (default: false)
 *   --pattern <str>   Extra substring filter applied to .pyc paths
 *   --fail-fast       Stop on first failing version
 *   --debug           Pass --debug through to run-fixtures
 */

const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function parseArgs() {
    const args = {
        includePypy: false,
        pattern: '',
        failFast: false,
        debug: false
    };
    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (arg === '--include-pypy') {
            args.includePypy = true;
        } else if (arg === '--pattern' && process.argv[i + 1]) {
            args.pattern = process.argv[++i];
        } else if (arg === '--fail-fast') {
            args.failFast = true;
        } else if (arg === '--debug') {
            args.debug = true;
        }
    }
    return args;
}

function listBytecodeDirs(root) {
    const entries = fs.readdirSync(root, {withFileTypes: true});
    const dirs = entries
        .filter(e => e.isDirectory() && e.name.startsWith('bytecode_'))
        .map(e => e.name)
        .sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
    return dirs;
}

function runVersion(dir, opts) {
    const args = ['scripts/run-fixtures.js', '--root', path.join('test', dir)];
    if (opts.pattern) {
        args.push('--pattern', opts.pattern);
    }
    if (opts.failFast) {
        args.push('--fail-fast');
    }
    if (opts.debug) {
        args.push('--debug');
    }
    const res = spawnSync('node', args, {stdio: 'pipe'});
    return {
        dir,
        code: res.status ?? 1,
        stdout: res.stdout.toString().trim(),
        stderr: res.stderr.toString().trim()
    };
}

function main() {
    const opts = parseArgs();
    const allDirs = listBytecodeDirs('test');
    const dirs = allDirs.filter(d => opts.includePypy || !d.includes('pypy'));

    let failures = [];
    for (const dir of dirs) {
        const result = runVersion(dir, opts);
        console.log(`\n=== ${dir} ===`);
        if (result.stdout) {
            console.log(result.stdout);
        }
        if (result.stderr) {
            console.error(result.stderr);
        }
        if (result.code !== 0) {
            failures.push(dir);
            if (opts.failFast) {
                break;
            }
        }
    }

    console.log(`\nMatrix complete. Failed: ${failures.length}/${dirs.length}${failures.length ? ' -> ' + failures.join(', ') : ''}`);
    process.exit(failures.length ? 1 : 0);
}

main();
