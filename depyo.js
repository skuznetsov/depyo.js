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
    rawSpacing: false,
    dump: false,
    asm: false,
    stats: false,
    skipSource: false,
    skipPath: false,
    sendToStdout: false,
    marshal: false,
    marshalScan: false,
    pyVersion: null,
    silent: false,
    fileExt: 'py',
    baseDir: null,
    filenames: []
};

let g_totalInThroughput = 0;
let g_totalOutThroughput = 0;
let g_totalExecTime = 0;
let g_totalFiles = 0;
let g_pyVersionInfo = null;
let g_marshalScanStats = {ok: 0, ambiguous: 0, failed: 0};

function printUsage() {
    console.log(`Usage: node depyo.js [options] <file.pyc|archive.zip> [...]

Options:
  --asm               Emit .pyasm disassembly alongside source
  --debug             Verbose logging during decompilation
  --raw               Save raw .pyc next to output
  --raw-spacing       Preserve blank lines (show potential comment gaps)
  --dump              Dump marshalled object tree (.dump)
  --stats             Print throughput stats
  --skip-source-gen   Do not emit .py source (useful with --asm/--dump)
  --skip-path         Flatten output paths (write files next to inputs)
  --out               Print decompiled source to stdout instead of files
  --marshal           Treat input as raw marshalled data (no .pyc header)
  --marshal-scan      Fast scan of marshal blobs (no decompile, prints version)
  --py-version <x.y>  Python bytecode version hint (auto-scan if omitted)
  --basedir <path>    Output base directory (default: alongside input)
  --file-ext <ext>    Extension for generated source (default: py)
`);
}

function parseCLIParams() {
    for (let idx = 2; idx < process.argv.length; idx++ ) {
        let cliParam = process.argv[idx];
        if (cliParam.toLowerCase() == "--asm") {
            g_cliArgs.asm = true;
        } else if (cliParam.toLowerCase() == "--debug") {
            g_cliArgs.debug = true;
        } else if (cliParam.toLowerCase() == "--raw") {
            g_cliArgs.raw = true;
        } else if (cliParam.toLowerCase() == "--raw-spacing") {
            g_cliArgs.rawSpacing = true;
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
        } else if (cliParam.toLowerCase() == "--marshal") {
            g_cliArgs.marshal = true;
        } else if (cliParam.toLowerCase() == "--marshal-scan" || cliParam.toLowerCase() == "--marshal-smoke") {
            g_cliArgs.marshalScan = true;
            g_cliArgs.marshal = true;
        } else if (cliParam.toLowerCase() == "--py-version") {
            g_cliArgs.pyVersion = process.argv[++idx];
        } else if (cliParam.toLowerCase() == "--basedir") {
            g_cliArgs.baseDir = process.argv[++idx];
        } else if (cliParam.toLowerCase() == "--file-ext") {
            g_cliArgs.fileExt = process.argv[++idx];
        } else if (cliParam.toLowerCase() == "--help" || cliParam.toLowerCase() == "-h") {
            printUsage();
            process.exit(0);
        } else {
            if (cliParam && cliParam.trim().length > 0) {
                g_cliArgs.filenames.push(cliParam);
            }
        }
    }
}

function normalizeMarshalOutput(src) {
    return src
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/#[^\n]*$/gm, '')
        .trim();
}

function scanMarshalBuffer(buffer, filenameLabel) {
    if (g_pyVersionInfo) {
        const trial = PycReader.TryParseMarshal(buffer, g_pyVersionInfo);
        if (!trial) {
            g_marshalScanStats.failed++;
            console.log(`${filenameLabel}: no parse with ${g_pyVersionInfo.major}.${g_pyVersionInfo.minor}`);
            return;
        }
        g_marshalScanStats.ok++;
        console.log(`${filenameLabel}: forced ${g_pyVersionInfo.major}.${g_pyVersionInfo.minor} unknown=${trial.unknown}/${trial.total} remaining=${trial.remaining}`);
        return;
    }

    const results = PycReader.ScanMarshalCandidates(buffer);
    if (!results.length) {
        g_marshalScanStats.failed++;
        console.log(`${filenameLabel}: no candidates`);
        return;
    }

    const best = results[0];
    const ambiguous = results.filter(r =>
        r.unknown === best.unknown &&
        r.remaining === best.remaining &&
        r.unknownRatio === best.unknownRatio
    );

    if (ambiguous.length > 1) {
        g_marshalScanStats.ambiguous++;
        const versions = ambiguous.map(r => `${r.versionInfo.major}.${r.versionInfo.minor}`).join(', ');
        console.log(`${filenameLabel}: ambiguous candidates (${versions})`);
        return;
    }

    g_marshalScanStats.ok++;
    console.log(`${filenameLabel}: best=${best.versionInfo.major}.${best.versionInfo.minor} unknown=${best.unknown}/${best.total} remaining=${best.remaining}`);
}

function attemptMarshalDecompile(buffer, versionInfo, opts = {}) {
    const prevSilent = g_cliArgs.silent;
    const prevDebug = g_cliArgs.debug;
    if (opts.silent) {
        g_cliArgs.silent = true;
        g_cliArgs.debug = false;
    }
    try {
        const rdr = new PycReader(buffer, {marshal: true, versionInfo});
        const obj = rdr.ReadObject();
        if (!obj || obj.ClassName !== "Py_CodeObject") {
            return null;
        }
        const opcodes = new versionInfo.opcode(obj);
        const {unknown, total} = PycReader.CountUnknownOpcodes(obj, rdr, opcodes.OpCodeList);
        const unknownRatio = total > 0 ? unknown / total : 1;
        const remaining = rdr.m_rdr.Reader.length - rdr.m_rdr.pc;

        const genStartTS = process.hrtime.bigint();
        const decompiler = new PycDecompiler(obj);
        const ast = decompiler.decompile();
        const pycResult = ast.codeFragment();
        const pySrc = pycResult.toString();
        const genSecs = Number(process.hrtime.bigint() - genStartTS) / 1000000000;

        return {
            reader: rdr,
            obj,
            pySrc,
            genSecs,
            cleanBuild: decompiler.cleanBuild,
            unknown,
            total,
            unknownRatio,
            remaining,
            versionInfo
        };
    } catch (ex) {
        if (opts.debug) {
            console.log(`Marshal decompile failed for ${versionInfo.major}.${versionInfo.minor}: ${ex.message}`);
        }
        return null;
    } finally {
        g_cliArgs.silent = prevSilent;
        g_cliArgs.debug = prevDebug;
    }
}

function selectMarshalCandidate(buffer) {
    const candidates = PycReader.ListSupportedVersions(false);
    const attempts = [];
    const cleanCandidates = [];
    let baselineOutput = null;
    let outputsDiverged = false;
    for (const candidate of candidates) {
        const result = attemptMarshalDecompile(buffer, candidate, {silent: true});
        if (!result) {
            continue;
        }
        attempts.push(result);
        const isWorking = result.cleanBuild && result.unknown === 0 && result.remaining === 0;
        if (isWorking) {
            const normalized = normalizeMarshalOutput(result.pySrc || '');
            cleanCandidates.push({...result, normalized});
            if (baselineOutput === null) {
                baselineOutput = normalized;
            } else if (baselineOutput !== normalized) {
                outputsDiverged = true;
            }
        }
    }

    if (!cleanCandidates.length) {
        return attempts.length ? {best: null, attempts, ambiguous: false} : null;
    }

    if (outputsDiverged) {
        return {best: null, attempts, ambiguous: true, cleanCandidates};
    }

    return {best: cleanCandidates[0], attempts, ambiguous: false};
}

function decompilePycObject(data) {
    try
    {
        let filename = null, obj = null;
        let startTS = process.hrtime.bigint();
        let buffer = data;
        if (!Buffer.isBuffer(buffer)) {
            buffer = fs.readFileSync(data);
        }
        if (g_cliArgs.marshalScan) {
            const label = typeof data === 'string' ? data : '<buffer>';
            scanMarshalBuffer(buffer, label);
            return;
        }
        let rdr = null;
        let pySrc = null;
        let genSecs = 0;

        if (g_cliArgs.marshal) {
            let attemptResult = null;
            if (g_pyVersionInfo) {
                attemptResult = attemptMarshalDecompile(buffer, g_pyVersionInfo);
            } else {
                const scan = selectMarshalCandidate(buffer);
                attemptResult = scan ? scan.best : null;
                if (g_cliArgs.debug && scan?.attempts?.length) {
                    console.log("Marshal scan results:");
                    for (const attempt of scan.attempts) {
                        const info = attempt.versionInfo;
                        console.log(`  ${info.major}.${info.minor}: clean=${attempt.cleanBuild} unknown=${attempt.unknown}/${attempt.total} remaining=${attempt.remaining}`);
                    }
                    if (attemptResult) {
                        const info = attemptResult.versionInfo;
                        console.log(`Selected marshal version: ${info.major}.${info.minor}`);
                    }
                }
                if (!attemptResult && scan?.ambiguous) {
                    const versions = scan.cleanCandidates
                        ? scan.cleanCandidates.map(c => `${c.versionInfo.major}.${c.versionInfo.minor}`).join(', ')
                        : 'unknown';
                    throw new Error(`Ambiguous marshal version (${versions}). Provide --py-version X.Y to force.`);
                }
            }

            if (!attemptResult) {
                throw new Error("No clean marshal candidate found. Provide --py-version X.Y to force.");
            }
            rdr = attemptResult.reader;
            obj = attemptResult.obj;
            pySrc = attemptResult.pySrc;
            genSecs = attemptResult.genSecs;
        } else {
            rdr = new PycReader(buffer);
            try {
                obj = rdr.ReadObject();
            } catch (ex) {
                if (ex instanceof PycReader.LoadError) {
                    // Save the binary file if it not already exists for future manual analysis.
                    if (!ex.FileName) {
                        if (global.g_cliArgs?.debug) {
                            console.log(`LoadError: ${ex.message} at position ${ex.position}`);
                        }
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
        }

        if (!obj) {
            return;
        }
        filename = g_baseDir + obj.FileName;

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
        if (!pySrc) {
            let genStartTS = process.hrtime.bigint();
            let decompiler = new PycDecompiler(obj);
            let ast = decompiler.decompile();
            let pycResult = ast.codeFragment();
            pySrc = pycResult.toString();
            genSecs = Number(process.hrtime.bigint() - genStartTS) / 1000000000;
        }
        if (!pySrc.endsWith("\n")) {
            pySrc += "\n";
        }
        genSecs = Math.max(genSecs, 0.000000001);
        if (g_cliArgs.sendToStdout) {
//            console.log(`\n\n${filenameBase}.${g_cliArgs.fileExt}\n-------\n${pySrc}`);
            console.log(pySrc);
        } else {
            fs.writeFileSync(filenameBase + "." + g_cliArgs.fileExt, pySrc);
        }
        let secs = parseInt(process.hrtime.bigint() - startTS) / 1000000000;
        g_totalExecTime += secs;
        let inThroughput = buffer.length / genSecs;
        let outThroughput = pySrc.length / genSecs;
        g_totalInThroughput += buffer.length;
        g_totalOutThroughput += pySrc.length;
        g_totalFiles++;
        if (g_cliArgs.stats) {
            console.log(`Done in ${genSecs.toFixed(3)}s. In: ${data.length} bytes (${inThroughput.toFixed(2)} B/s). Out: ${pySrc.length} bytes (${outThroughput.toFixed(2)} B/s).`);
        }
    }
    catch (ex)
    {
        console.log(`EXCEPTION: ${ex}`);
        if (g_cliArgs.debug) {
            console.log(ex.stack);
        }
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
if (g_cliArgs.pyVersion && !g_cliArgs.marshal) {
    console.log("Error: --py-version requires --marshal (headerless input).");
    process.exit(1);
}
if (g_cliArgs.pyVersion) {
    g_pyVersionInfo = PycReader.ResolveVersionTag(g_cliArgs.pyVersion);
    if (!g_pyVersionInfo) {
        console.log(`Error: unsupported --py-version "${g_cliArgs.pyVersion}". Use format X.Y (e.g., 3.11).`);
        process.exit(1);
    }
}
if (g_cliArgs.filenames.length === 0) {
    printUsage();
    process.exit(1);
}

const baseInputDir = g_cliArgs.baseDir ? g_cliArgs.baseDir : Path.dirname(g_cliArgs.filenames[0] || '.');
g_baseDir = Path.resolve(baseInputDir, 'decompiled') + '/';

DecompileModule(g_cliArgs.filenames);

if (g_cliArgs.marshalScan) {
    console.log(`Marshal scan summary: ok=${g_marshalScanStats.ok}, ambiguous=${g_marshalScanStats.ambiguous}, failed=${g_marshalScanStats.failed}`);
    if (g_marshalScanStats.failed > 0) {
        process.exit(1);
    }
    if (g_marshalScanStats.ambiguous > 0) {
        process.exit(2);
    }
    process.exit(0);
}

if (!g_cliArgs.sendToStdout) {
    const inRate = (g_totalInThroughput / g_totalExecTime).toFixed(2);
    const outRate = (g_totalOutThroughput / g_totalExecTime).toFixed(2);
    console.log(`Processed ${g_totalFiles} files in ${g_totalExecTime.toFixed(3)}s. In: ${g_totalInThroughput} bytes (${inRate} B/s). Out: ${g_totalOutThroughput} bytes (${outRate} B/s).`);
}
