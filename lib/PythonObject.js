class PythonObject {
    ClassName = null;
    Value = null;

    constructor(class_name, value) {
        this.ClassName = class_name || null;
        this.Value = value || null;
    }

    add(po) {
        if (["Py_List", "Py_Tuple", "Py_Set", "Py_FrozenSet"].includes(this.ClassName))
        {
            let list = this.Value;

            if (list == null) {
                list = [];
                this.Value = list;
            }

            list.push(po);
        }
    }

    add(key, val) {
        if (this.ClassName == "Py_Dict") {
            let dict = this.Value;
            if (dict == null)
            {
                dict = {};
                this.Value = dict;
            }

            dict[key] = val;
        }
    }

    get length() {
        if (["Py_String", "Py_List", "Py_Tuple", "Py_Set", "Py_FrozenSet", "Py_VeryLong"].includes(this.ClassName)) {
            if (this.Value && this.Value.length) {
                return this.Value.length;
            } else {
                return 0;
            }
        } else if (this.ClassName == "Py_Dict") {
            if (this.Value) {
                return Object.keys(this.Value);
            } else {
                return 0;
            }
        } else {
            return 1;
        }
    }

    // TODO: Refactor to use Symbol.toPrimitive() and Object.valueOf()

    toString()
    {
        switch(this.ClassName) {
            case "Py_Unicode":
            case "Py_String":
                let strValue = this.Value;
                if (!strValue || strValue.length == 0) {
                    return "''";
                }
                strValue = strValue.toString();
                if (strValue.includes("\n")) {
                    strValue = strValue.replaceAll("\n", "\\n");
                }
                return strValue;

            case "Py_Int":
            case "Py_Long":
            case "Py_Long64":
                return this.Value !== null ? this.Value.toString() : "0";

            case "Py_Interned":
                return this.Value !== null ? this.Value.toString() : "0";

            case "Py_Float":
                return this.Value !== null ? `${this.Value}${Number.isInteger(this.Value) ? ".0" : ""}` : "0.0";

            case "Py_VeryLong":
                if (this.Value) {
                    if (this.Value.length < 8) {
                        return this.Value.toString();
                    } else {
                        let result = "0x";
                        result += this.Value[this.Value.length - 1].toString(16);
                        for (let idx = this.Value.length - 2; idx >= 0; idx--) {
                            result += this.Value[idx].toString(16);
                        }
                        return result;
                    }
                } else {
                    return "0";
                }

            case "Py_Null":
                return "None";

            case "Py_False":
                return "False";

            case "Py_True":
                return "True";

            case "Py_None":
                return "None";

            case "Py_Tuple":
            case "Py_Set":
            case "Py_FrozenSet":
                let res = "(";
                if (this.Value) {
                    for (let obj of this.Value) {
                        if (res != "(") {
                            res += ", " + obj;
                        } else {
                            res += obj;
                        }
                    }
                    res += ")";
                    return res;
                } else {
                    return "null";
                }

            case "Py_CodeObject":
                return `<code object ${this.Name.toString()}, file '${this.FileName.toString()}', line ${this.FirstLineNo}>`;

            case "Py_Dict":
                if (this.Value) {
                    let res = "(";
                    for (let pair of Object.entries(obj.Value)) {
                        if (res != "(") {
                            res += ", " + pair[0] + ": " + pair[1];
                        } else {
                            res += pair[0] + ": " + pair[1];
                        }
                    }
                    res += ")";
                    return res;
                } else {
                    return "()";
                }

            case "Py_StringRef":
                return this.Strings[this.Value];

            default:
                return ["Py_String"].includes(this.ClassName) ? this.Value.toString("ascii") : null;
        }
    }
}

class PythonCodeObject extends PythonObject {
    ArgCount = 0;
    PosOnlyArgCount = 0;
    KWOnlyArgCount = 0;
    NumLocals = 0;
    StackSize = 0;
    Flags = 0;
    Code = null;
    Consts = [];
    Names = [];
    VarNames = [];
    FreeVars = [];
    CellVars = [];
    FileName = null;
    Name = null;
    FirstLineNo = 0;
    LineNoTab = [];
    LineNoTabObject = null;
    Methods = [];
    SourceCode = null;
    FuncParams = null;
    FuncDecos = null;
    FuncName = null;
    ASTTree = [];
    Globals = new Set();

    getLineNumber(offset, isVer310 = false) {
        if (offset < 0) {
            return this.FirstLineNo;
        }

        if (this.LineNoTabObject.Value.length < 2 || offset >= this.Code.length) {
            return -1;
        }

        let lnTable = this.LineNoTabObject.Value;
        let size = lnTable.length / 2;
        let sDelta = 0;
        let lDelta = 0;

        let line = this.FirstLineNo;
        let addr = 0;
        let index = 0;
        while (--size >= 0) {
            sDelta = lnTable[index++];
            lDelta = lnTable[index++];

            addr += sDelta;
            if (addr > offset)
                break;

            if (isVer310 && lDelta == -128) { // Should we treat no line number? or treat it as previous line?
                lDelta = 0;
            }

            line += lDelta;
        }
        return line;
    }
}


module.exports = {PythonObject, PythonCodeObject};

// Registering classes in global scope for propoer class deserialization.
for (let className of Object.keys(module.exports)) {
    global[className] = new module.exports[className]();
}
