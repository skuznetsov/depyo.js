#!/usr/bin/env node

const PycReader = require('./lib/PycReader')
const PycDecompiler = require('./lib/PycDecompiler');
const PycDisassembler = require('./lib/PycDisassembler');
const fs = require('fs');
const path = require('path');

function DecompileModule(filename)
{

    try
    {
        let rdr = new PycReader(filename);
        let obj = rdr.ReadObject();
        let filenameBase = filename.substring(0, filename.lastIndexOf('.'));
        if (process.argv.includes('--dump')) {
            fs.writeFileSync(filenameBase + ".dump", PycReader.DumpObject(obj));
        }
        if (process.argv.includes('--asm')) {
            fs.writeFileSync(filenameBase + ".pyasm", PycDisassembler.Disassemble(obj));
        }
        fs.writeFileSync(filenameBase + ".py", PycDecompiler.Decompile(obj).toString());
    }
    catch (ex)
    {
        console.log(`EXCEPTION: ${ex}`);
    }
}

DecompileModule("/Users/sergey/Forensics/EVE/EVE_Mac_Client/tq/EVE.app/Contents/Resources/build/code/carbon/common/script/net/machoNet.pyo");