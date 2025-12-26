#!/usr/bin/env node

/**
 * Generate marshal fixtures from existing .pyc files.
 * Writes headerless .marshal blobs and copies expected .py outputs.
 *
 * Usage:
 *   node scripts/generate-marshal-fixtures.js [--clean]
 */

const fs = require('fs');
const path = require('path');
const {PycReader} = require('../lib/PycReader');

global.g_cliArgs = {debug: false, silent: true};

const ROOT = 'test/marshal';
const FIXTURES = [
    // 1.x
    {pyc: 'test/bytecode_1.0/unpack_assign.pyc', outDir: `${ROOT}/bytecode_1.0`},
    {pyc: 'test/bytecode_1.0/simple_const.pyc', outDir: `${ROOT}/bytecode_1.0`},

    // 2.x
    {pyc: 'test/bytecode_2.4/01_class.pyc', outDir: `${ROOT}/bytecode_2.4`},
    {pyc: 'test/bytecode_2.7/01_list_comprehension.pyc', outDir: `${ROOT}/bytecode_2.7`},

    // 3.x (heavier coverage)
    {pyc: 'test/bytecode_3.0/02_ifelse_lambda.pyc', outDir: `${ROOT}/bytecode_3.0`},
    {pyc: 'test/bytecode_3.6/01_matrix_multiply.pyc', outDir: `${ROOT}/bytecode_3.6`},
    {pyc: 'test/bytecode_3.8/02_async_for.pyc', outDir: `${ROOT}/bytecode_3.8`},
    {pyc: 'test/bytecode_3.8/03_if_try.pyc', outDir: `${ROOT}/bytecode_3.8`},
    {pyc: 'test/bytecode_3.9/py38_walrus_basic.pyc', outDir: `${ROOT}/bytecode_3.9`},
    {pyc: 'test/bytecode_3.9/py38_walrus_simple.pyc', outDir: `${ROOT}/bytecode_3.9`},
    {pyc: 'test/bytecode_3.9/py38_fstring_equals.pyc', outDir: `${ROOT}/bytecode_3.9`},
    {pyc: 'test/bytecode_3.9/py38_positional_only.pyc', outDir: `${ROOT}/bytecode_3.9`},
    {pyc: 'test/bytecode_3.9/py39_dict_merge.pyc', outDir: `${ROOT}/bytecode_3.9`},
    {pyc: 'test/bytecode_3.10/py310_match_basic.pyc', outDir: `${ROOT}/bytecode_3.10`},
    {pyc: 'test/bytecode_3.11/py311_exception_groups.pyc', outDir: `${ROOT}/bytecode_3.11`},
    {pyc: 'test/bytecode_3.11/py311_exception_notes.pyc', outDir: `${ROOT}/bytecode_3.11`},
    {pyc: 'test/bytecode_3.12/py312_type_params.pyc', outDir: `${ROOT}/bytecode_3.12`},
    {pyc: 'test/bytecode_3.12/py312_type_alias.pyc', outDir: `${ROOT}/bytecode_3.12`},
    {pyc: 'test/bytecode_3.12/py311_exception_notes.pyc', outDir: `${ROOT}/bytecode_3.12`},
    {pyc: 'test/bytecode_3.13/py313_with_prep_reraise.pyc', outDir: `${ROOT}/bytecode_3.13`},
    {pyc: 'test/bytecode_3.14/py314_with_except_star.pyc', outDir: `${ROOT}/bytecode_3.14`},
    {pyc: 'test/bytecode_3.14/py314_formatting.pyc', outDir: `${ROOT}/bytecode_3.14`},
    {pyc: 'test/bytecode_3.14/py314_exception_notes.pyc', outDir: `${ROOT}/bytecode_3.14`}
];

function parseArgs() {
    return {
        clean: process.argv.includes('--clean')
    };
}

function* walkDirForPy(dirPath) {
    if (!fs.existsSync(dirPath)) return;
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
    const decompiledRoot = path.join(dir, 'decompiled');
    if (!fs.existsSync(decompiledRoot)) {
        return null;
    }
    const matches = [];
    for (const candidate of walkDirForPy(decompiledRoot)) {
        if (path.basename(candidate, '.py') === base) {
            matches.push(candidate);
        }
    }
    if (matches.length === 1) {
        return matches[0];
    }
    if (matches.length > 1) {
        return matches[0];
    }
    return null;
}

function generateFixture({pyc, outDir}) {
    const buffer = fs.readFileSync(pyc);
    const reader = new PycReader(buffer);
    const headerSize = reader.m_rdr.pc;
    const base = path.basename(pyc, '.pyc');
    fs.mkdirSync(outDir, {recursive: true});
    const marshalPath = path.join(outDir, `${base}.marshal`);
    fs.writeFileSync(marshalPath, buffer.slice(headerSize));

    const expected = findExpectedFile(pyc);
    if (!expected) {
        throw new Error(`Expected .py not found for ${pyc}`);
    }
    const expectedDir = path.join(outDir, 'decompiled');
    fs.mkdirSync(expectedDir, {recursive: true});
    const expectedOut = path.join(expectedDir, `${base}.py`);
    fs.copyFileSync(expected, expectedOut);
}

function main() {
    const args = parseArgs();
    if (args.clean && fs.existsSync(ROOT)) {
        fs.rmSync(ROOT, {recursive: true, force: true});
    }
    for (const fixture of FIXTURES) {
        generateFixture(fixture);
    }
    console.log(`Generated ${FIXTURES.length} marshal fixtures.`);
}

main();
