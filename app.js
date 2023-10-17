#!/usr/bin/env node

const PycReader = require('./lib/PycReader')
const PycDecompiler = require('./lib/PycDecompiler');
const PycDisassembler = require('./lib/PycDisassembler');
const ZipReader = require('./lib/zip_reader');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

let g_baseDir = './decompiled/';
let g_cliArgs = {
    raw: false,
    dump: false,
    asm: false,
    stats: false,
    skipSource: false,
    baseDir: null,
    filename: []
};

let g_totalThroughput = 0;
let g_totalExecTime = 0;
let g_totalFiles = 0;

function parseCLIParams() {
    for (let idx = 2; idx < process.argv.length; idx++ ) {
        let cliParam = process.argv[idx];
        if (cliParam.toLowerCase() == "--asm") {
            g_cliArgs.asm = true;
        } else if (cliParam.toLowerCase() == "--raw") {
            g_cliArgs.raw = true;
        } else if (cliParam.toLowerCase() == "--dump") {
            g_cliArgs.dump = true;
        } else if (cliParam.toLowerCase() == "--stats") {
            g_cliArgs.stats = true;
        } else if (cliParam.toLowerCase() == "--skip-source-gen") {
            g_cliArgs.skipSource = true;
        } else if (cliParam.toLowerCase() == "--basedir") {
            g_cliArgs.baseDir = process.argv[++idx];
        } else {
            g_cliArgs.filename.push(cliParam);
        }
    }
}

function decompilePycObject(data) {
    try
    {
        let startTS = process.hrtime.bigint();
        let rdr = new PycReader(data);
        let obj = rdr.ReadObject();
        let filename = g_baseDir + obj.FileName;
        console.log(`Processing ${filename}...`);
        let dirPath =  path.dirname(filename);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, {recursive: true});
        }
        let filenameBase = filename.substring(0, filename.lastIndexOf('.'));
        if (g_cliArgs.raw) {
            fs.writeFileSync(filenameBase + ".pyc", rdr.Reader);
        }
        if (g_cliArgs.dump) {
            fs.writeFileSync(filenameBase + ".dump", PycReader.DumpObject(obj));
        }
        if (g_cliArgs.asm) {
            fs.writeFileSync(filenameBase + ".pyasm", PycDisassembler.Disassemble(obj));
        }
        fs.writeFileSync(filenameBase + ".py", PycDecompiler.Decompile(obj).toString());
        let secs = parseInt(process.hrtime.bigint() - startTS) / 1000000000;
        g_totalExecTime += secs;
        let throughput = data.length / secs;
        g_totalThroughput += data.length;
        g_totalFiles++;
        if (g_cliArgs.stats) {
            console.log(`Done in ${secs} secs. Throughput: ${throughput} bytes/second.`);
        }
    }
    catch (ex)
    {
        console.log(`EXCEPTION: ${ex}`);
    }
}


function DecompileModule(filenames)
{
    for (let filename of filenames) {
        let zipReader = new ZipReader(filename);
        if (zipReader.isZipFile()) {
            for (let entry of zipReader.entries()) {
                let uncompressedData = zlib.inflateSync(entry.data);

                decompilePycObject(uncompressedData);
            }
        } else {
            decompilePycObject(filename);
        }
    }
}

parseCLIParams()
g_baseDir = (g_cliArgs.baseDir ? g_cliArgs.baseDir : path.dirname(g_cliArgs.filename)) + '/decompiled/';

DecompileModule(g_cliArgs.filename);
if (g_cliArgs.stats) {
    console.log(`Processed ${g_totalFiles} files in ${g_totalExecTime} secs. Throughput: ${g_totalThroughput/g_totalExecTime} bytes/second.`);
}
