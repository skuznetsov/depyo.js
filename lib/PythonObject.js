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
                dict = [];
                this.Value = dict;
            }

            dict.push({key, value: val});
        }
    }

    get length() {
        if (["Py_String", "Py_List", "Py_Dict", "Py_Tuple", "Py_Set", "Py_FrozenSet", "Py_VeryLong"].includes(this.ClassName)) {
            if (this.Value && this.Value.length) {
                return this.Value.length;
            } else {
                return 0;
            }
        } else {
            return 1;
        }
    }

    // TODO: Refactor to use Symbol.toPrimitive() and Object.valueOf()

    toReprString() {
        if (this.ClassName === "Py_String" || this.ClassName === "Py_Unicode") {
            let raw = this.Value;
            if (raw == null || raw.length === 0) return '""';
            raw = raw.toString();
            let escaped = raw
                .replace(/\\/g, '\\\\')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t')
                .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, c =>
                    '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'));
            let quote = '"';
            if (escaped.includes('"')) {
                if (!escaped.includes("'")) {
                    quote = "'";
                } else {
                    escaped = escaped.replace(/"/g, '\\"');
                }
            }
            return quote + escaped + quote;
        }
        return this.toString();
    }

    toString()
    {
        switch(this.ClassName) {
            case "Py_Unicode":
            case "Py_String":
                let strValue = this.Value;
                if (strValue.ClassName) {
                    throw new SyntaxError("Recursion");
                }
                if (!strValue || strValue.length == 0) {
                    return "";
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

            case "Py_Float": {
                if (this.Value === null) return "0.0";
                let s = `${this.Value}`;
                // Python rejects `1e+300.0`; only append `.0` when the
                // printed form is pure digits (optional sign).
                if (/^-?\d+$/.test(s)) {
                    s += ".0";
                }
                return s;
            }

            case "Py_VeryLong":
                if (this.Value) {
                    if (this.Value.length < 8) {
                        return this.Value.toString();
                    } else {
                        let result = "0x";
                        let skipFirstZeros = true;
                        let shortFlag = true;
                        for (let idx = this.Value.length - 1; idx >= 0; idx--) {
                            let value = this.Value[idx];
                            value = value.toString(16);
                            if (skipFirstZeros && value == 0) {
                                continue;
                            } else if (skipFirstZeros && value) {
                                skipFirstZeros = false;
                            }
                            if (!shortFlag) {
                                value = value.length < 2 ? "0" + value : value;
                            }
                            shortFlag = false;
                            result += value;
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
                        const part = obj instanceof PythonObject ? obj.toReprString() : String(obj);
                        if (res != "(") {
                            res += ", " + part;
                        } else {
                            res += part;
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
                    for (let pair of this.Value) {
                        if (res != "(") {
                            res += ", ";
                        }
                        const kPart = pair.key instanceof PythonObject ? pair.key.toReprString() : String(pair.key);
                        const vPart = pair.value instanceof PythonObject ? pair.value.toReprString() : String(pair.value);
                        res += kPart + ": " + vPart;
                    }
                    res += ")";
                    return res;
                } else {
                    return "()";
                }

            case "Py_StringRef":
                return this.Strings[this.Value];

            case "Py_Complex":
                return `${this.Value[0]}+${this.Value[1]}j`;
    
            default:
                return ["Py_String"].includes(this.ClassName) ? this.Value.toString("ascii") : null;
        }
    }
}

class PythonCodeObject extends PythonObject {
    ClassName = "Py_CodeObject";
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
    ExceptionTable = null;  // Python 3.11+ exception table (raw bytes or parsed entries)
    Methods = [];
    SourceCode = null;
    FuncParams = null;
    FuncDecos = null;
    FuncName = null;
    ASTTree = [];
    Globals = new Set();
    CachedLineNo = -1;

    getLineNumber(offset, isVer310 = false) {
        if (offset < 0) {
            return this.FirstLineNo;
        }

        if (this.CachedLineNo > -1) {
            return this.CachedLineNo;
        }

        if (!this.LineNoTabObject || this.LineNoTabObject.Value.length < 2 || offset >= this.Code.length) {
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
