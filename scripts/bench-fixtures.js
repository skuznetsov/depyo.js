#!/usr/bin/env node

/**
 * Lightweight benchmark runner for fixtures.
 * Walks .pyc files under a root and measures decompile throughput.
 *
 * Options:
 *   --root <dir>     Fixture root (default: test/bytecode_3.11)
 *   --pattern <str>  Substring filter applied to .pyc paths
 *   --limit <n>      Max files to process (default: all)
 *   --repeat <n>     Number of benchmark passes (default: 3)
 *   --debug          Enable verbose decompile logs
 *
 * Example:
 *   node scripts/bench-fixtures.js --root test/bytecode_3.12 --pattern py311_exception_groups
 */

const fs = require('node:fs');
const path = require('node:path');
const {performance} = require('node:perf_hooks');
const {PycReader} = require('../lib/PycReader');
const PycDecompiler = require('../lib/PycDecompiler');

global.g_cliArgs = {debug: false};

function parseArgs() {
    const args = {
        root: 'test/bytecode_3.11',
        pattern: '',
        limit: 0,
        repeat: 3,
        debug: false
    };

    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (arg === '--root' && process.argv[i + 1]) {
            args.root = process.argv[++i];
        } else if (arg === '--pattern' && process.argv[i + 1]) {
            args.pattern = process.argv[++i];
        } else if (arg === '--limit' && process.argv[i + 1]) {
            args.limit = parseInt(process.argv[++i], 10) || 0;
        } else if (arg === '--repeat' && process.argv[i + 1]) {
            args.repeat = Math.max(1, parseInt(process.argv[++i], 10) || 1);
        } else if (arg === '--debug') {
            args.debug = true;
        }
    }
    return args;
}

function* walkPyc(dirPath) {
    const entries = fs.readdirSync(dirPath, {withFileTypes: true});
    for (const entry of entries) {
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            yield* walkPyc(full);
        } else if (entry.isFile() && entry.name.endsWith('.pyc')) {
            yield full;
        }
    }
}

function decompilePyc(file) {
    const buf = fs.readFileSync(file);
    const reader = new PycReader(buf);
    const obj = reader.ReadObject();
    const dec = new PycDecompiler(obj);
    const ast = dec.decompile();
    return ast.codeFragment().toString();
}

function runBench(files, repeat, debug) {
    global.g_cliArgs.debug = !!debug;
    const timings = [];
    for (let r = 0; r < repeat; r++) {
        const start = performance.now();
        for (const f of files) {
            decompilePyc(f);
        }
        const end = performance.now();
        timings.push(end - start);
    }
    return timings;
}

function summarize(timings, filesCount) {
    const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;
    const minMs = Math.min(...timings);
    const maxMs = Math.max(...timings);
    const perFile = avgMs / Math.max(1, filesCount);
    const throughput = filesCount ? (filesCount / (avgMs / 1000)) : 0;
    return {avgMs, minMs, maxMs, perFile, throughput};
}

function main() {
    const args = parseArgs();
    if (!fs.existsSync(args.root)) {
        console.error(`Root not found: ${args.root}`);
        process.exit(1);
    }

    const files = [];
    for (const f of walkPyc(args.root)) {
        if (args.pattern && !f.includes(args.pattern)) continue;
        files.push(f);
        if (args.limit && files.length >= args.limit) break;
    }

    if (!files.length) {
        console.log('No .pyc files matched selection.');
        return;
    }

    console.log(`Benchmarking ${files.length} file(s) from ${args.root}${args.pattern ? ` pattern=${args.pattern}` : ''}, repeat=${args.repeat}`);
    const timings = runBench(files, args.repeat, args.debug);
    const stats = summarize(timings, files.length);
    console.log(`timings (ms): min=${stats.minMs.toFixed(2)} avg=${stats.avgMs.toFixed(2)} max=${stats.maxMs.toFixed(2)}`);
    console.log(`per-file avg: ${stats.perFile.toFixed(2)} ms, throughput: ${stats.throughput.toFixed(2)} pyc/s`);
}

main();
