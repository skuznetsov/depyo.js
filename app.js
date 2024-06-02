#!/usr/bin/env node

const {PycReader} = require('./lib/PycReader')
const PycDecompiler = require('./lib/PycDecompiler');
const PycDisassembler = require('./lib/PycDisassembler');
const ZipReader = require('./lib/zip_reader');
const zlib = require('zlib');
const fs = require('fs');
const Path = require('path');
const PycResult = require('./lib/PycResult');

let g_baseDir = './decompiled/';
global.g_cliArgs = {
    debug: false,
    raw: false,
    dump: false,
    asm: false,
    stats: false,
    skipSource: false,
    skipPath: false,
    sendToStdout: false,
    fileExt: 'py',
    baseDir: null,
    filenames: []
};

let g_totalInThroughput = 0;
let g_totalOutThroughput = 0;
let g_totalExecTime = 0;
let g_totalFiles = 0;

function parseCLIParams() {
    for (let idx = 2; idx < process.argv.length; idx++ ) {
        let cliParam = process.argv[idx];
        if (cliParam.toLowerCase() == "--asm") {
            g_cliArgs.asm = true;
        } else if (cliParam.toLowerCase() == "--debug") {
            g_cliArgs.debug = true;
        } else if (cliParam.toLowerCase() == "--raw") {
            g_cliArgs.raw = true;
        } else if (cliParam.toLowerCase() == "--dump") {
            g_cliArgs.dump = true;
        } else if (cliParam.toLowerCase() == "--stats") {
            g_cliArgs.stats = true;
        } else if (cliParam.toLowerCase() == "--skip-source-gen") {
            g_cliArgs.skipSource = true;
        } else if (cliParam.toLowerCase() == "--skip-path") {
            g_cliArgs.skipPath = true;
        } else if (cliParam.toLowerCase() == "--out") {
            g_cliArgs.sendToStdout = true;
        } else if (cliParam.toLowerCase() == "--basedir") {
            g_cliArgs.baseDir = process.argv[++idx];
        } else if (cliParam.toLowerCase() == "--file-ext") {
            g_cliArgs.fileExt = process.argv[++idx];
        } else {
            g_cliArgs.filenames.push(cliParam);
        }
    }
}

function decompilePycObject(data) {
    try
    {
        let filename = null, obj = null;
        let startTS = process.hrtime.bigint();
        let rdr = new PycReader(data);
        try {
            obj = rdr.ReadObject();
            filename = g_baseDir + obj.FileName;
        } catch (ex) {
            if (ex instanceof PycReader.LoadError) {
                // Save the binary file if it not already exists for future manual analysis.
                if (!ex.FileName) {
                    return;
                }
                filename = g_baseDir + ex.FileName;
                let dirPath =  Path.dirname(filename);
                if (!g_cliArgs.skipPath && !fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, {recursive: true});
                }
                let filenamePyc = filename.substring(0, filename.lastIndexOf('.')) + ".pyc";
                fs.writeFileSync(filenamePyc, rdr.Reader);
                console.log(`Error: ${ex.message}\nFile: ${filenamePyc}\nPosition: ${ex.position}`);
                return;
            }
            console.log(`Error: ${ex.message}\nStack:\n${ex.stacktrace}`);
            return;
        }

        if (!g_cliArgs.sendToStdout) {
            console.log(`Processing ${filename}...`);
        }
        let dirPath =  Path.dirname(filename);
        let filenameBase = filename.substring(0, filename.lastIndexOf('.'));
        if (g_cliArgs.skipPath) {
            filenameBase = "./" + filenameBase.substring(dirPath.length + 1);
        }

        if (!g_cliArgs.sendToStdout) {
            if (!g_cliArgs.skipPath && !fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, {recursive: true});
            }
            if (g_cliArgs.raw) {
                fs.writeFileSync(filenameBase + ".pyc", rdr.Reader);
            }
            if (g_cliArgs.dump) {
                fs.writeFileSync(filenameBase + ".dump", PycReader.DumpObject(obj));
            }
            if (g_cliArgs.asm) {
                fs.writeFileSync(filenameBase + ".pyasm", PycDisassembler.Disassemble(rdr, obj));
            }
        }
        let genStartTS = process.hrtime.bigint();
        let ast = PycDecompiler.Decompile(obj);
        let pycResult = ast.codeFragment();
        let pySrc = pycResult.toString();
        let genSecs = parseInt(process.hrtime.bigint() - genStartTS) / 1000000000;
        if (g_cliArgs.sendToStdout) {
//            console.log(`\n\n${filenameBase}.${g_cliArgs.fileExt}\n-------\n${pySrc}`);
            console.log(pySrc);
        } else {
            fs.writeFileSync(filenameBase + "." + g_cliArgs.fileExt, pySrc);
        }
        let secs = parseInt(process.hrtime.bigint() - startTS) / 1000000000;
        g_totalExecTime += secs;
        let inThroughput = data.length / genSecs;
        let outThroughput = pySrc.length / genSecs;
        g_totalInThroughput += data.length;
        g_totalOutThroughput += pySrc.length;
        g_totalFiles++;
        if (g_cliArgs.stats) {
            console.log(`Done in ${genSecs} secs. In Throughput: ${inThroughput} bytes/second. Out Throughput: ${outThroughput} bytes/second.`);
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
        try {
            let zipReader = new ZipReader(filename);
            if (zipReader.isZipFile()) {
                for (let entry of zipReader.entries()) {
                    let uncompressedData = zlib.inflateSync(entry.data);

                    decompilePycObject(uncompressedData);
                }
            } else {
                decompilePycObject(filename);
            }
        } catch (ex) {
            console.log(`Processing of file ${filename} was unsuccessful due to: ${ex.message}`);
        }
    }
}

parseCLIParams()
g_baseDir = (g_cliArgs.baseDir ? g_cliArgs.baseDir : Path.dirname(g_cliArgs.filenames[0])) + '/decompiled/';

DecompileModule(g_cliArgs.filenames);

if (!g_cliArgs.sendToStdout) {
    console.log(`Processed ${g_totalFiles} files in ${g_totalExecTime} secs. In: ${g_totalInThroughput} bytes. In Throughput: ${g_totalInThroughput/g_totalExecTime} bytes/second.  Out ${g_totalOutThroughput} bytes. Out Throughput: ${g_totalOutThroughput/g_totalExecTime} bytes/second.`);
}
