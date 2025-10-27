const {PycReader} = require('./lib/PycReader');
const fs = require('fs');

global.g_cliArgs = {debug: false};

if (process.argv.length < 3) {
    console.log("Usage: node dump_bytecode.js <file.pyc>");
    process.exit(1);
}

const filename = process.argv[2];
try {
    const reader = new PycReader(filename);
    const ver = reader.m_version || {major: '?', minor: '?'};
    console.log(`Python ${ver.major}.${ver.minor}`);
    console.log("===================================");

    const obj = reader.ReadObject();
    console.log(`Object: ${JSON.stringify({Type: obj.Type, hasValue: !!obj.Value}, null, 2)}`);

    if (!obj || !obj.Value) {
        console.log("Failed to read code object");
        return;
    }

    if (obj.Value) {
        const code = obj.Value;
        console.log(`Module: ${code.Name || '<module>'}`);
        console.log(`Constants: ${code.Consts ? code.Consts.length : 0}`);

        // Show all code objects in constants
        if (code.Consts) {
            for (let i = 0; i < code.Consts.length; i++) {
                const c = code.Consts[i];
                if (c && c.Value && c.Value.Code) {
                    console.log(`\n--- Function ${i}: ${c.Value.Name} ---`);
                    const instructions = c.Value.getInstructions();
                    for (let j = 0; j < instructions.length && j < 80; j++) {
                        const instr = instructions[j];
                        let arg = instr.HasArgument ? ` (arg=${instr.Argument})` : '';
                        let offset = String(instr.Offset).padStart(4, ' ');
                        let name = instr.InstructionName.padEnd(30, ' ');
                        console.log(`  ${offset}: ${name}${arg}`);
                    }
                }
            }
        }
    }
} catch (e) {
    console.error("Error:", e.message);
}
