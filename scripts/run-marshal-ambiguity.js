#!/usr/bin/env node

/**
 * Ensure marshal auto-scan refuses ambiguous versions without --py-version.
 */

const {execFileSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const candidate = path.join('test', 'marshal', 'bytecode_3.10', 'py310_match_basic.marshal');
if (!fs.existsSync(candidate)) {
    console.error(`Missing fixture: ${candidate}`);
    process.exit(1);
}

let output = '';
try {
    output = execFileSync('node', ['depyo.js', '--marshal', '--out', candidate], {encoding: 'utf8'});
} catch (err) {
    output = err.stdout || err.message || '';
}

if (!output.includes('Ambiguous marshal version')) {
    console.error('Expected ambiguous marshal version error, got:\n' + output);
    process.exit(1);
}

console.log('Ambiguous marshal scan check: ok');
