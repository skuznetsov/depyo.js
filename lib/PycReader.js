const fs = require('fs');
const {BinaryReader} = require('./BinaryReader');
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
const TypeCode2 = 'C';
const TypeUnicode = 'u';
const TypeUnknown = '?';
const TypeSet = '<';
const TypeFrozenset = '>';
const TypeAscii = 'a';
const TypeAsciiInterned = 'A';
const TypeSmallTuple = ')';
const TypeShortAscii = 'z';
const TypeShortAsciiInterned = 'Z';
const TypeObjectReference = 'r';

const MagicToVersion = {
    0x00999902: {major: 1, minor: 0, IsUnicode: false, opcode: require('./bytecode/python_1_0')},
    0x00999903: {major: 1, minor: 1, IsUnicode: false, opcode: require('./bytecode/python_1_1')}, /* Also covers 1.2 */
    0x0A0D2E89: {major: 1, minor: 3, IsUnicode: false, opcode: require('./bytecode/python_1_3')},
    0x0A0D1704: {major: 1, minor: 4, IsUnicode: false, opcode: require('./bytecode/python_1_4')},
    0x0A0D4E99: {major: 1, minor: 5, IsUnicode: false, opcode: require('./bytecode/python_1_5')},

    0x0A0DC4FC: {major: 1, minor: 6, IsUnicode: false, opcode: require('./bytecode/python_1_6')},
    0x0A0DC4FD: {major: 1, minor: 6, IsUnicode: true, opcode: require('./bytecode/python_1_6')},


    0x0A0DC687: {major: 2, minor: 0, IsUnicode: false, opcode: require('./bytecode/python_2_0')},
    0x0A0DC688: {major: 2, minor: 0, IsUnicode: true, opcode: require('./bytecode/python_2_0')},

    0x0A0DEB2A: {major: 2, minor: 1, IsUnicode: false, opcode: require('./bytecode/python_2_1')},
    0x0A0DEB2B: {major: 2, minor: 1, IsUnicode: true, opcode: require('./bytecode/python_2_1')},

    0x0A0DED2D: {major: 2, minor: 2, IsUnicode: false, opcode: require('./bytecode/python_2_2')},
    0x0A0DED2E: {major: 2, minor: 2, IsUnicode: true, opcode: require('./bytecode/python_2_2')},

    0x0A0DF23B: {major: 2, minor: 3, IsUnicode: false, opcode: require('./bytecode/python_2_3')},
    0x0A0DF23C: {major: 2, minor: 3, IsUnicode: true, opcode: require('./bytecode/python_2_3')},

    0x0A0DF26D: {major: 2, minor: 4, IsUnicode: false, opcode: require('./bytecode/python_2_4')},
    0x0A0DF26E: {major: 2, minor: 4, IsUnicode: true, opcode: require('./bytecode/python_2_4')},

    0x0A0DF2B3: {major: 2, minor: 5, IsUnicode: false, opcode: require('./bytecode/python_2_5')},
    0x0A0DF2B4: {major: 2, minor: 5, IsUnicode: true, opcode: require('./bytecode/python_2_5')},

    0x0A0DF2D1: {major: 2, minor: 6, IsUnicode: false, opcode: require('./bytecode/python_2_6')},
    0x0A0DF2D2: {major: 2, minor: 6, IsUnicode: true, opcode: require('./bytecode/python_2_6')},

    0x0A0DF303: {major: 2, minor: 7, IsUnicode: false, opcode: require('./bytecode/python_2_7')},
    0x0A0DF304: {major: 2, minor: 7, IsUnicode: true, opcode: require('./bytecode/python_2_7')},


    0x0A0D0C3A: {major: 3, minor: 0, IsUnicode: true, opcode: require('./bytecode/python_3_0')},
    0x0A0D0C4E: {major: 3, minor: 1, IsUnicode: true, opcode: require('./bytecode/python_3_1')},
    0x0A0D0C6C: {major: 3, minor: 2, IsUnicode: true, opcode: require('./bytecode/python_3_2')},
    0x0A0D0C9E: {major: 3, minor: 3, IsUnicode: true, opcode: require('./bytecode/python_3_3')},
    0x0A0D0CEE: {major: 3, minor: 4, IsUnicode: true, opcode: require('./bytecode/python_3_4')},
    0x0A0D0D16: {major: 3, minor: 5, IsUnicode: true, opcode: require('./bytecode/python_3_5')},
    0x0A0D0D17: {major: 3, minor: 5, revision: 3, IsUnicode: true, opcode: require('./bytecode/python_3_5')},
    0x0A0D0D33: {major: 3, minor: 6, IsUnicode: true, opcode: require('./bytecode/python_3_6')},
    0x0A0D0D42: {major: 3, minor: 7, IsUnicode: true, opcode: require('./bytecode/python_3_7')},
    0x0A0D0D55: {major: 3, minor: 8, IsUnicode: true, opcode: require('./bytecode/python_3_8')},
    0x0A0D0D61: {major: 3, minor: 9, IsUnicode: true, opcode: require('./bytecode/python_3_9')},
    0x0A0D0D6F: {major: 3, minor: 10, IsUnicode: true, opcode: require('./bytecode/python_3_10')},
    0x0A0D0DA7: {major: 3, minor: 11, IsUnicode: true, opcode: require('./bytecode/python_3_11')},
    0x0A0D0DCB: {major: 3, minor: 12, IsUnicode: true, opcode: require('./bytecode/python_3_12')}
};


class PycReader
{
    static LoadError = class extends Error {

        FileName = null;
        position = -1;
        constructor (msg, filename, pc) {
            super(msg);
            this.FileName = filename;
            this.position = pc;
        }
    }

    Strings = [];
    Objects = [];
    m_rdr = null;
    m_filename = null;
    m_version = null;

    constructor(data) {
        if (!data) {
            return;
        }
        
        let buffer = data;
        if (typeof(data) == 'string') {
            buffer = fs.readFileSync(data);
        } else if (!Buffer.isBuffer(buffer)) {
            throw new Error('PycReader accepts only String as a file path or Buffer as content.');
        }
        this.m_rdr = new BinaryReader(buffer);
        
        let marshalVersion = this.m_rdr.readUInt32();
        this.m_version = MagicToVersion[marshalVersion] || MagicToVersion[marshalVersion & 0xFFFFFFFE] || {major: -1, minor: -1, IsUnicode: false};

        let flags = 0;
        let timeStamp = 0;
        let size = 0;

        if (this.versionCompare(3, 7) >= 0) {
            flags = this.m_rdr.readUInt32();
        }

        if (flags & 1) {
            this.m_rdr.readUInt32()
            this.m_rdr.readUInt32()
        } else {
            timeStamp = this.m_rdr.readUInt32();

            if (this.versionCompare(3, 3) >= 0) {
                size = this.m_rdr.readUInt32();
            }
        }

        if (global.g_cliArgs.debug) {
            console.log(`Python version: ${this.m_version.major}.${this.m_version.minor}`);
            console.log(`timestamp: ${new Date(timeStamp * 1000)}`);
        }
    }

    get Reader() {
        return this.m_rdr.Reader;
    }

    get OpCodes() {
        return this.m_version.opcode;
    }

    ReadObject() {
        try {
            let obj = new PythonObject(), value = null;
            let charCode = this.m_rdr.readChar().charCodeAt(0);
            let objectType = String.fromCharCode(charCode & 0x7f);
            let isInterned = false;


            if ((charCode & 0x80) == 0x80) {
                this.Objects.push(obj);
            }

            switch (objectType) {
                case TypeObjectReference:
                    let objectIndex = this.m_rdr.readInt32();
                    if (objectIndex >= this.Objects.length) {
                        throw new LoadError("Referense is outside of the boundaries", this.m_filename, this.m_rdr.pc);
                    }
                    return this.Objects[objectIndex];
                case TypeNull:
                    obj.ClassName = "Py_Null";
                    break;
                case TypeNone:
                    obj.ClassName = "Py_None";
                    break;
                case TypeStopiter:
                    obj.ClassName = "Py_StopIteration";
                    break;
                case TypeEllipsis:
                    obj.ClassName = "Py_Ellipsis";
                    break;
                case TypeFalse:
                    obj.ClassName = "Py_False";
                    break;
                case TypeTrue:
                    obj.ClassName = "Py_True";
                    break;
                case TypeInt:
                    obj.ClassName = "Py_Int";
                    obj.Value = this.m_rdr.readInt32();
                    break;
                case TypeInt64:
                    obj.ClassName = "Py_VeryLong";
                    obj.Value = this.m_rdr.readBytes(8);
                    break;
                case TypeLong:
                    let longValue = [];
                    let d = 0;
                    let n = this.m_rdr.readInt32();
                    if (n == 0) {
                        obj.ClassName = "Py_Long";
                        obj.Value = 0;
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

                    obj.ClassName = "Py_VeryLong";
                    obj.Value = longValue;
                    break;
                case TypeFloat:
                    obj.ClassName = "Py_Float";
                    obj.Value = parseFloat(this.ReadString());
                    break;
                case TypeBinaryFloat:
                    obj.ClassName = "Py_Float";
                    obj.Value = this.m_rdr.readDouble();
                    break;
                case TypeComplex:
                    obj.ClassName = "Py_Complex";
                    obj.Value = [parseFloat(this.ReadString()), parseFloat(this.ReadString())];
                    break;
                case TypeBinaryComplex:
                    obj.ClassName = "Py_Complex";
                    obj.Value = [this.m_rdr.readDouble(), this.m_rdr.readDouble()];
                    break;
                case TypeInterned:
                    isInterned = true;
                case TypeString:
                    value = this.m_rdr.readBytes(this.m_rdr.readUInt32()); // .toString("ascii");
                    obj.ClassName = "Py_String";
                    obj.Value = value;
                    if (isInterned) {
                        this.Strings.push(value);
                    }
                    break;
                case TypeUnicode:
                    value = this.ReadString(this.m_rdr.readUInt32());
                    obj.ClassName = "Py_Unicode";
                    obj.Value = value;
                    break;
                case TypeStringRef:
                    let listPos = this.m_rdr.readUInt32();
                    obj.ClassName = "Py_String";
                    obj.Value = (listPos < this.Strings.length ? this.Strings[listPos] : null);
                    break;
                case TypeAsciiInterned:
                case TypeShortAsciiInterned:
                    isInterned = true;
                case TypeAscii:
                case TypeShortAscii:
                    let ascii = this.m_rdr.readBytes([TypeAscii, TypeAsciiInterned].includes(objectType) ? this.m_rdr.readUInt32() : this.m_rdr.readByte()).toString("ascii");
                    obj.ClassName = "Py_String";
                    obj.Value =  ascii;
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
                    obj.ClassName = "Py_Tuple";
                    obj.Value = tuples;
                    break;
                case TypeList:
                    let nListElements = this.m_rdr.readUInt32();
                    let list = [];
                    for (let currentIndex = 0; currentIndex < nListElements; currentIndex++) {
                        list.push(this.ReadObject());
                    }
                    obj.ClassName = "Py_List";
                    obj.Value = list;
                    break;
                case TypeDict:
                    let dict = [];
                    while(true)
                    {
                        let key = this.ReadObject();
                        if (key.ClassName == "Py_Null")
                            break;
                        let dictValue = this.ReadObject();
                        dict.push({key, value: dictValue});
                    }
                    obj.ClassName = "Py_Dict";
                    obj.Value = dict;
                    break;
                case TypeSet:
                    let nSetElements = this.m_rdr.readUInt32();
                    let set = [];
                    for (let currentIndex = 0; currentIndex < nSetElements; currentIndex++)
                    {
                        set.push(this.ReadObject());
                    }
                    obj.ClassName = "Py_Set";
                    obj.Value = set;
                    break;
                case TypeFrozenset:
                    let nFSetElements = this.m_rdr.readUInt32();
                    let frozenSet = [];
                    for (let currentIndex = 0; currentIndex < nFSetElements; currentIndex++)
                    {
                        frozenSet.push(this.ReadObject());
                    }
                    obj.ClassName = "Py_FrozenSet";
                    obj.Value = frozenSet;
                    break;
                case TypeCode:
                case TypeCode2:
                    let codeObj = this.ReadCodeObject();
                    for (let prop of Object.keys(codeObj)) {
                        if (Object.hasOwn(codeObj, prop)) {
                            obj[prop] = codeObj[prop];
                        }
                    }
                    Object.setPrototypeOf(obj, Object.getPrototypeOf(codeObj));
                    break;
                default:
                    throw new PycReader.LoadError(`Don't know how to handle object Type ${objectType}'`, this.m_filename, this.m_rdr.pc);
            }

            obj.Reader = this;

            return obj;
        } catch(ex) {
            throw ex;
        }
    }

    static ConvertBytesToString(bytes) {
        return Buffer.from(bytes).toString("utf8");
    }

    ReadString(size) {
        if (size === undefined) {
            size = this.m_rdr.readByte();
        }
        if (!size) {
            return "";
        }
        return this.m_rdr.readString(size);
    }

    ReadCodeObject() {
        let codeObject = new PythonCodeObject();

        let argCount = 0;

        if (this.versionCompare(1, 3) >= 0 && this.versionCompare(2, 3) < 0) {
            argCount = this.m_rdr.readUInt16();
        } else if (this.versionCompare(2, 3) >= 0) {
            argCount = this.m_rdr.readUInt32();
        }
        codeObject.ArgCount = argCount;

        codeObject.PosOnlyArgCount = this.versionCompare(3, 8) >= 0 ? this.m_rdr.readUInt32() : 0;
        codeObject.KWOnlyArgCount = this.versionCompare(3, 0) >= 0 ? this.m_rdr.readUInt32() : 0;
        
        codeObject.NumLocals = 0;
        if (this.versionCompare(1, 3) >= 0 && this.versionCompare(2, 3) < 0) {
            codeObject.NumLocals = this.m_rdr.readUInt16();
        } else if (this.versionCompare(2, 3) >= 0 && this.versionCompare(3, 11) < 0) {
            codeObject.NumLocals = this.m_rdr.readUInt32();
        }

        codeObject.StackSize = 0;
        if (this.versionCompare(1, 5) >= 0 && this.versionCompare(2, 3) < 0) {
            codeObject.StackSize = this.m_rdr.readUInt16();
        } else if (this.versionCompare(2, 3) >= 0) {
            codeObject.StackSize = this.m_rdr.readUInt32();
        }

        codeObject.Flags = 0;
        if (this.versionCompare(1, 3) >= 0 && this.versionCompare(2, 3) < 0) {
            codeObject.Flags = this.m_rdr.readUInt16();
        } else if (this.versionCompare(2, 3) >= 0) {
            codeObject.Flags = this.m_rdr.readUInt32();
        }

        codeObject.Code = this.ReadObject();
        codeObject.Consts = this.ReadObject();
        codeObject.Names = this.ReadObject();

        codeObject.VarNames = this.versionCompare(1, 3) >= 0 ? this.ReadObject() : new PythonObject("Py_Tuple", []);
        codeObject.VarKinds = this.versionCompare(3, 11) >= 0 ? this.ReadObject() : new PythonObject("Py_String", "");
        codeObject.FreeVars = this.versionCompare(2, 1) >= 0 && this.versionCompare(3, 11) < 0 ? this.ReadObject() : new PythonObject("Py_Tuple", []);
        codeObject.CellVars =this.versionCompare(2, 1) >= 0 && this.versionCompare(3, 11) < 0 ? this.ReadObject() : new PythonObject("Py_Tuple", []);
        codeObject.FileName = this.ReadObject().toString();

        if (!this.m_filename) {
            this.m_filename = codeObject.FileName;
        }

        codeObject.Name = this.ReadObject().toString();
        codeObject.QualName = this.versionCompare(3, 11) >= 0 ? this.ReadObject() : new PythonObject("Py_String", "");

        codeObject.FirstLineNo = 0;
        if (this.versionCompare(1, 5) >= 0 && this.versionCompare(2, 3) < 0) {
            codeObject.FirstLineNo = this.m_rdr.readUInt16();
        } else if (this.versionCompare(2, 3) >= 0) {
            codeObject.FirstLineNo = this.m_rdr.readUInt32();
        }

        codeObject.Methods = {};
        codeObject.LineNoTab = [];
        if (this.versionCompare(1, 5) >= 0) {
            this.UnpackLineNumbers(codeObject);
        }
        if (this.versionCompare(3, 11) >= 0) {
            codeObject.exceptTable = this.ReadObject();
        } else {
            codeObject.exceptTable = new PythonObject("Py_String", "");
        }

        return codeObject;
    }

    UnpackLineNumbers(codeObject) {
        codeObject.LineNoTab = [];
        let lineno = this.ReadObject();
        let bytePos = 0, currentBytePos = 0;
        let linePos = codeObject.FirstLineNo;
        codeObject.LineNoTabObject = lineno;
        for (let idx = 0; idx < lineno.Value.length; idx += 2) {
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

    versionCompare(major, minor) {
        return (this.m_version.major - major) * 100 + (this.m_version.minor - minor);
    }
}

module.exports = {PycReader};

// Registering classes in global scope for propoer class deserialization.
for (let className of Object.keys(module.exports)) {
    global[className] = new module.exports[className]();
}
