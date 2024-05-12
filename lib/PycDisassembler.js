const OpCodes = require('./OpCodes');
const { PythonCodeObject } = require('./PythonObject');

class PycDisassembler
{
    static Disassemble (reader, obj, parentPrefix) {
        let methodName = `${parentPrefix || ""}${parentPrefix ? "." : ""}${obj.Name}`;
        let result = `Method name: ${methodName}:\n`;
        let code = new reader.OpCodes(obj);

        while (code.HasInstructionsToProcess) {
            try {
                code.GoNext();
                let argValue = "";
                let opCode =  code.Current;

                if (opCode.HasConstant) {
                        argValue = opCode.Constant;
                } else if (opCode.HasName) {
                    argValue = opCode.Name;
                } else if (opCode.HasCompare) {
                    argValue = opCode.CompareOperator;
                } else if (opCode.HasLocal) {
                    argValue = opCode.LocalName;
                } else if (opCode.HasFree) {
                        argValue = opCode.FreeName;
                }
                if(opCode.HasJumpRelative) {
                    opCode.Argument += opCode.Offset + 3;
                }

                result += "\t" + [pad(`O:${opCode.Offset}, L:${obj.LineNoTab[opCode.Offset]}`, 13), pad(opCode.InstructionName, 19), pad(opCode.HasArgument ? opCode.Argument : "", 4), " ", argValue != "" ? "(" + argValue + ")" : ""].join(" ") + "\n";
            } catch (ex) {
                result += "EXCEPTION: " + ex.toString();
            }
        }

        for (let code_obj of obj.Consts.Value.filter(o => o instanceof PythonCodeObject)) {
            result += "\n";
            result += PycDisassembler.Disassemble(reader, code_obj, methodName);
        }

        return result;
    }
}

function pad(str, len) {
    let spaces = "";
    let strLen = str.toString().length;
    for (let idx=0; idx < len - strLen; idx++) {
        spaces += " ";
    }

    return spaces + str;

}
module.exports = PycDisassembler;
