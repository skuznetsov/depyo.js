const fs = require('fs');
const BinaryReader = require('./BinaryReader');
const {PythonObject, PythonCodeObject} = require('./PythonObject');

const PyLong_MARSHAL_SHIFT = 15;
const PyLong_MARSHAL_RATIO = 30 / PyLong_MARSHAL_SHIFT;
const PyLong_MARSHAL_BASE = 0x8000;
const PyLong_MARSHAL_MASK = 0x7FFF;

const TypeNull = '0';
const TypeNone = 'N';
const TypeFalse = 'F';
const TypeTrue = 'T';
const TypeStopiter = 'S';
const TypeEllipsis = '.';
const TypeInt = 'i';
const TypeInt64 = 'I';
const TypeFloat = 'f';
const TypeBinaryFloat = 'g';
const TypeComplex = 'x';
const TypeBinaryComplex = 'y';
const TypeLong = 'l';
const TypeString = 's';
const TypeInterned = 't';
const TypeStringRef = 'R';
const TypeTuple = '(';
const TypeList = '[';
const TypeDict = '{';
const TypeCode = 'c';
const TypeUnicode = 'u';
const TypeUnknown = '?';
const TypeSet = '<';
const TypeFrozenset = '>';
const FlagRef = '\x80';
const TypeAscii = 'a';
const TypeAsciiInterned = 'A';
const TypeSmallTuple = ')';
const TypeShortAscii = 'z';
const TypeShortAsciiInterned = 'Z';

class PycReader
{
    Strings = [];
    m_rdr = null;

    constructor(filePath) {
        this.m_rdr = new BinaryReader(fs.readFileSync(filePath));
        let marshalVersion = this.m_rdr.readUInt32();
        console.log(`Python version: ${marshalVersion & 0xFFFF}`);
        let timeStamp = this.m_rdr.readUInt32();
        console.log(`timestamp: ${new Date(timeStamp * 1000)}`);
    }

    ReadObject() {
        try {
            let obj = null, value = null;
            let objectType = this.m_rdr.readChar();
            let isInterned = false;

            switch (objectType) {
                case TypeNull:
                    obj = new PythonObject("Py_Null");
                    break;
                case TypeNone:
                    obj = new PythonObject("Py_None");
                    break;
                case TypeStopiter:
                    obj = new PythonObject("Py_StopIteration");
                    break;
                case TypeEllipsis:
                    obj = new PythonObject("Py_Ellipsis");
                    break;
                case TypeFalse:
                    obj = new PythonObject("Py_False");
                    break;
                case TypeTrue:
                    obj = new PythonObject("Py_True");
                    break;
                case TypeInt:
                    obj = new PythonObject("Py_Int", this.m_rdr.readInt32());
                    break;
                case TypeInt64:
                    obj = new PythonObject("Py_Long", this.m_rdr.readBytes(8));
                    break;
                case TypeLong:
                    let longValue = [];
                    let d = 0;
                    let n = this.m_rdr.readInt32();
                    if (n == 0) {
                        obj = new PythonObject("Py_Long", 0);
                        break;
                    } 
                    let size = 1 + (Math.abs(n) - 1) / PyLong_MARSHAL_RATIO;
                    let shorts_in_top_digit = 1 + (Math.abs(n) - 1) % PyLong_MARSHAL_RATIO;

                    for (let idx = 0; idx < size - 1; idx++) {
                        d = 0;
                        for (let j = 0; j < PyLong_MARSHAL_RATIO; j++) {
                            let md = this.m_rdr.readInt16();
                            if (md < 0 || md > PyLong_MARSHAL_BASE) {
                                throw new Error("cannot demarshal a long data");
                            }
                            d += md << (j * PyLong_MARSHAL_SHIFT);
                        }
                        longValue.push(d);
                    }

                    d = 0;
                    for (let j = 0; j < shorts_in_top_digit; j++) {
                        let md = this.m_rdr.readInt16();
                        if (md < 0 || md > PyLong_MARSHAL_BASE) {
                            throw new Error("cannot demarshal a long data");
                        }
                        d += md << (j * PyLong_MARSHAL_SHIFT);
                    }
                    longValue.push(d);

                    obj = new PythonObject("Py_VeryLong", longValue);
                    break;
                case TypeFloat:
                    obj = new PythonObject("Py_Float", parseFloat(this.ReadString()));
                    break;
                case TypeBinaryFloat:
                    obj = new PythonObject("Py_Float", this.m_rdr.readDouble());
                    break;
                case TypeComplex:
                    obj = new PythonObject("Py_Complex",[parseFloat(this.ReadString()), parseFloat(this.ReadString())]);
                    break;
                case TypeBinaryComplex:
                    obj = new PythonObject("Py_Complex",[this.m_rdr.readDouble(), this.m_rdr.readDouble()]);
                    break;
                case TypeInterned:
                    isInterned = true;
                case TypeString:
                    value = this.m_rdr.readBytes(this.m_rdr.readUInt32()); // .toString("ascii");
                    obj = new PythonObject("Py_String", value);
                    if (isInterned) {
                        this.Strings.push(value);
                    }
                    break;
                case TypeUnicode:
                    value = this.ReadString(this.m_rdr.readUInt32());
                    obj = new PythonObject("Py_Unicode", value);
                    break;
                case TypeStringRef:
                    let listPos = this.m_rdr.readUInt32();
                    obj = new PythonObject("Py_String", (listPos < this.Strings.length ? this.Strings[listPos] : null));
                    break;
                case TypeAsciiInterned:
                case TypeShortAsciiInterned:
                    isInterned = true;
                case TypeAscii:
                case TypeShortAscii:
                    let ascii = this.m_rdr.readBytes([TypeAscii, TypeAsciiInterned].includes(objectType) ? this.m_rdr.readUInt32() : this.m_rdr.readByte()).toString("ascii");
                    obj = new PythonObject("Py_String", ascii);
                    if (isInterned) {
                        this.Strings.push(ascii);
                    }
                    break;
                case TypeSmallTuple:
                case TypeTuple:
                    let nTuples = objectType == TypeTuple ? this.m_rdr.readUInt32() : this.m_rdr.readByte();
                    let tuples = [];
                    for (let currentIndex = 0; currentIndex < nTuples; currentIndex++) {
                        tuples.push(this.ReadObject());
                    }
                    obj = new PythonObject("Py_Tuple", tuples);
                    break;
                case TypeList:
                    let nListElements = this.m_rdr.readUInt32();
                    let list = [];
                    for (let currentIndex = 0; currentIndex < nListElements; currentIndex++) {
                        list.push(this.ReadObject());
                    }
                    obj = new PythonObject("Py_List", list);
                    break;
                case TypeDict:
                    let dict = {};
                    while(true)
                    {
                        let key = this.ReadObject();
                        if (key.ClassName == "Py_Null")
                            break;
                        let dictValue = this.ReadObject();
                        dict[key] = dictValue;
                    }
                    obj = new PythonObject("Py_Dict", dict);
                    break;
                case TypeSet:
                    let nSetElements = this.m_rdr.readUInt32();
                    let set = [];
                    for (let currentIndex = 0; currentIndex < nSetElements; currentIndex++)
                    {
                        set.push(this.ReadObject());
                    }
                    obj = new PythonObject("Py_Set", set);
                    break;
                case TypeFrozenset:
                    let nFSetElements = this.m_rdr.readUInt32();
                    let frozenSet = [];
                    for (let currentIndex = 0; currentIndex < nFSetElements; currentIndex++)
                    {
                        frozenSet.push(this.ReadObject());
                    }
                    obj = new PythonObject("Py_FrozenSet", frozenSet);
                    break;
                case TypeCode:
                    obj = this.ReadCodeObject();
                    break;
                default:
                    throw new Error(`Don't know how to handle object Type ${objectType}'`);
            }

            return obj;
        } catch(ex) {
            console.log(ex);
            throw ex;
        }
    }

    static ConvertBytesToString(bytes) {
        return Buffer.from(bytes).toString("utf8");
    }

    ReadString(size) {
        size = size || this.m_rdr.readByte();
        return this.m_rdr.readString(size);
    }

    ReadCodeObject() {
        let codeObject = new PythonCodeObject("Py_CodeObject");

        codeObject.ArgCount = this.m_rdr.readUInt32();
        // codeObject.PosOnlyArgCount = this.m_rdr.readUInt32();
        // codeObject.KWOnlyArgCount = this.m_rdr.readUInt32();
        codeObject.NumLocals = this.m_rdr.readUInt32();
        codeObject.StackSize = this.m_rdr.readUInt32();
        codeObject.Flags = this.m_rdr.readUInt32();
        codeObject.Code = this.ReadObject();
        codeObject.Consts = this.ReadObject();
        codeObject.Names = this.ReadObject();
        codeObject.VarNames = this.ReadObject();
        codeObject.FreeVars = this.ReadObject();
        codeObject.CellVars = this.ReadObject();
        codeObject.FileName = this.ReadObject().toString();
        codeObject.Name = this.ReadObject().toString();
        codeObject.FirstLineNo = this.m_rdr.readUInt32();
        codeObject.Methods = {};
        codeObject.LineNoTab = [];
        this.UnpackLineNumbers(codeObject);

        return codeObject;
    }

    UnpackLineNumbers(codeObject) {
        codeObject.LineNoTab = [];
        let lineno = this.ReadObject();
        let bytePos = 0, currentBytePos = 0;
        let linePos = codeObject.FirstLineNo;
        for (let idx = 0; idx < lineno.length; idx += 2) {
            bytePos += lineno.Value[idx];
            while (currentBytePos < bytePos) {
                codeObject.LineNoTab.push(linePos);
                currentBytePos++;
            }
            linePos += lineno.Value[idx + 1];
        }

        while (currentBytePos < codeObject.Code.Value.length) {
            codeObject.LineNoTab.push(linePos);
            currentBytePos++;
        }
    }

    static DumpObject(obj, level) {
        let result = "";
        level = level || 0;

        for (let idx = 0; idx < level; idx++) {
            result += "  ";
        }
        
        try {
            switch (obj.ClassName)
            {
                case "Py_Null":
                    result += "Py_NULL\n";
                    break;
                case "Py_None":
                    result += "Py_None\n";
                    break;
                case "Py_StopIteration":
                    result += `Py_StopIteration, Value = ${obj.toString()}\n`;
                    break;
                case "Py_Ellipsis":
                    result += `Py_Ellipsis, Value = ${obj.toString()}\n`;
                    break;
                case "Py_False":
                    result += "Py_False\n";
                    break;
                case "Py_True":
                    result += "Py_True\n";
                    break;
                case "Py_Int":
                    result += `Py_Int, Value = ${obj.toString()}\n`;
                    break;
                case "Py_Long":
                    result += `Py_Long, Value = ${obj.toString()}\n`;
                    break;
                case "Py_VeryLong":
                    result += `Py_VeryLong, Value = ${obj.toString()}\n`;
                    break;
                case "Py_Float":
                    result += `Py_Float, Value = ${obj.toString()}\n`;
                    break;
                case "Py_Complex":
                    result += `Py_Complex, Value = ${obj.toString()}\n`;
                    break;
                case "Py_Unicode":
                    result += `Py_Unicode, Value = "${obj.toString()}"\n`;
                    break;
                case "Py_String":
                    result += `Py_String, Value = "${obj.toString()}"\n`;
                    break;
                case "Py_Tuple":
                    result += "Py_Typle:\n";
                    for (let item of obj.Value) {
                        result += PycReader.DumpObject(item, level + 1);
                    }
                    break;
                case "Py_List":
                    result += "Py_List:\n";
                    for (let item of obj.Value) {
                        result += PycReader.DumpObject(item, level + 1);
                    }
                    break;
                case "Py_Dict":
                    result += "Py_Dict:\n";
                    for (let pair of Object.entries(obj.Value)) {
                        result += "Dict Key:\n";
                        result += PycReader.DumpObject(pair[0], level + 1);
                        result += "Dict Value:\n";
                        result += PycReader.DumpObject(pair[1], level + 1);
                    }
                    break;
                case "Py_Set":
                    result += "Py_Set:\n";
                    for (let item of obj.Value) {
                        result += PycReader.DumpObject(item, level + 1);
                    }
                    break;
                case "Py_FrozenSet":
                    result += "Py_FrozenSet:\n";
                    for (let item of obj.Value) {
                        result += PycReader.DumpObject(item, level + 1);
                    }
                    break;
                case "Py_CodeObject":
                    result += "Py_CodeObject\n";
                    let codeObject = obj;
                    if (codeObject == null)
                        break;
                    let pars = "";
                    if (codeObject.ArgCount > 0) {
                        for(let idx = 0; idx < codeObject.ArgCount; idx++) {
                            pars += pars == "" ? codeObject.VarNames.Value[idx].toString() : ", " + codeObject.VarNames.Value[idx].toString();
                        }
                    }
                    result += `Code Object: ${codeObject.Name && codeObject.Name.Value && codeObject.Name.toString()} (${pars})\n`;
                    result += `ArgCount = ${codeObject.ArgCount}\n`;
                    result += `NumLocals ${codeObject.NumLocals}\n`;
                    result += `StackSize ${codeObject.StackSize}\n`;
                    result += `Flags ${codeObject.Flags}\n`;
                    if (codeObject.Consts && codeObject.Consts.Value) {
                        result += "Consts:\n"; 
                        for (let item of codeObject.Consts.Value) {
                            result += PycReader.DumpObject(item, level + 1);
                        }
                    }
                    if (codeObject.Names && codeObject.Names.Value) {
                        result += "Names:\n";
                        for (let item of codeObject.Names.Value) {
                            result += PycReader.DumpObject(item, level + 1);
                        }
                    }
                    if (codeObject.VarNames && codeObject.VarNames.Value) {
                        result += "VarNames:\n";
                        for (let item of codeObject.VarNames.Value) {
                            result += PycReader.DumpObject(item, level + 1);
                        }
                    }
                    if (codeObject.FreeVars && codeObject.FreeVars.Value) {
                        result += "FreeVars:\n";
                        for (let item of codeObject.FreeVars.Value) {
                            result += PycReader.DumpObject(item, level + 1);
                        }
                    }
                    if (codeObject.CellVars && codeObject.CellVars.Value) {
                        result += "CellVars:\n";
                        for (let item of codeObject.CellVars.Value) {
                            result += PycReader.DumpObject(item, level + 1);
                        }
                    }
                    result += `FileName = ${codeObject.FileName && codeObject.FileName.Value && codeObject.FileName.toString()}\n`;
                    result += `Name = ${codeObject.Name && codeObject.Name.Value && codeObject.Name.toString()}\n`;
                    result += `FirstLineNo = ${codeObject.FirstLineNo}\n`;
                    // result += `Code:\n${PycDisassembler.Disassembler(codeObject)}\n`;
                    break;
                default:
                    result += `No such type ${obj.ClassName}. Value = ${obj.Value}\n`;
                    break;
            }
        } catch(ex) {
            console.log(`DumpObject error: ${ex}`);
        }
        return result;
    }

    static GetMethodParametersString(codeObject)
    {
        let pars = "";
        if (codeObject.ArgCount > 0) {
            for (let idx = 0; idx < codeObject.ArgCount; idx++) {
                pars += pars == "" ? codeObject.VarNames[idx] : ", " + codeObject.VarNames[idx];
            }
        }
        return pars;
    }
}

module.exports = PycReader;