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
const KnownTypes = new Set([
    TypeNull, TypeNone, TypeFalse, TypeTrue, TypeStopiter, TypeEllipsis,
    TypeInt, TypeInt64, TypeFloat, TypeBinaryFloat, TypeComplex, TypeBinaryComplex,
    TypeLong, TypeString, TypeInterned, TypeStringRef, TypeTuple, TypeList,
    TypeDict, TypeCode, TypeCode2, TypeUnicode, TypeUnknown, TypeSet, TypeFrozenset,
    TypeAscii, TypeAsciiInterned, TypeSmallTuple, TypeShortAscii, TypeShortAsciiInterned,
    TypeObjectReference
]);

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
    0x0A0D0D41: {major: 3, minor: 7, IsUnicode: true, opcode: require('./bytecode/python_3_7')},
    0x0A0D0D42: {major: 3, minor: 7, IsUnicode: true, opcode: require('./bytecode/python_3_7')},
    0x0A0D0D49: {major: 3, minor: 8, IsUnicode: true, opcode: require('./bytecode/python_3_8')},
    0x0A0D0D55: {major: 3, minor: 8, IsUnicode: true, opcode: require('./bytecode/python_3_8')},
    0x0A0D0D61: {major: 3, minor: 9, IsUnicode: true, opcode: require('./bytecode/python_3_9')},
    0x0A0D0D6F: {major: 3, minor: 10, IsUnicode: true, opcode: require('./bytecode/python_3_10')},
    0x0A0D0DA7: {major: 3, minor: 11, IsUnicode: true, opcode: require('./bytecode/python_3_11')},
    0x0A0D0DCB: {major: 3, minor: 12, IsUnicode: true, opcode: require('./bytecode/python_3_12')},
    0x0A0D0DF3: {major: 3, minor: 13, IsUnicode: true, opcode: require('./bytecode/python_3_13')},
    0x0A0D0E2B: {major: 3, minor: 14, IsUnicode: true, opcode: require('./bytecode/python_3_14')}
};

const VersionAliases = {
    "1.2": "1.1"
};

const VersionToInfo = {};
for (const [magic, info] of Object.entries(MagicToVersion)) {
    const key = `${info.major}.${info.minor}`;
    const existing = VersionToInfo[key];
    const candidate = {...info, magic: Number(magic)};
    if (!existing || (candidate.revision || 0) > (existing.revision || 0)) {
        VersionToInfo[key] = candidate;
    }
}

function parseVersionTag(tag) {
    if (!tag) {
        return null;
    }
    const cleaned = String(tag).trim().replace(/^python/i, '').replace(/^py/i, '');
    const match = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
    if (!match || match[2] === undefined) {
        return null;
    }
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    if (Number.isNaN(major) || Number.isNaN(minor)) {
        return null;
    }
    return {major, minor};
}


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

    constructor(data, options = {}) {
        if (!data) {
            return;
        }
        
        const opts = options || {};
        this.m_filename = opts.filename || null;

        let buffer = data;
        if (typeof(data) == 'string') {
            buffer = fs.readFileSync(data);
        } else if (!Buffer.isBuffer(buffer)) {
            throw new Error('PycReader accepts only String as a file path or Buffer as content.');
        }
        this.m_rdr = new BinaryReader(buffer);

        if (opts.marshal) {
            let versionInfo = opts.versionInfo;
            if (!versionInfo && opts.pyVersion) {
                versionInfo = PycReader.ResolveVersionTag(opts.pyVersion);
            }
            if (!versionInfo) {
                throw new Error('Marshal mode requires a bytecode version. Pass --py-version or pre-resolve it.');
            }
            this.m_version = versionInfo;
            if (global.g_cliArgs?.debug && !opts.silent) {
                console.log(`Marshal mode: Python ${this.m_version.major}.${this.m_version.minor}`);
            }
            return;
        }
        
        let marshalVersion = this.m_rdr.readUInt32();
        this.m_version = MagicToVersion[marshalVersion] || MagicToVersion[marshalVersion & 0xFFFFFFFE] || {major: -1, minor: -1, IsUnicode: false};

        // Fallback: pick nearest known magic if opcode table is missing (helps PyPy forks)
        if (!this.m_version.opcode) {
            let nearest = null, bestDiff = Number.MAX_SAFE_INTEGER;
            for (const [magic, info] of Object.entries(MagicToVersion)) {
                const diff = Math.abs(parseInt(magic) - marshalVersion);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    nearest = info;
                }
            }
            if (nearest && bestDiff <= 0x1000) {
                this.m_version = nearest;
                if (global.g_cliArgs?.debug) {
                    console.warn(`Using nearest magic match (diff=0x${bestDiff.toString(16)}) -> Python ${nearest.major}.${nearest.minor}`);
                }
            }
        }

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

    static ResolveVersionTag(tag) {
        const parsed = parseVersionTag(tag);
        if (!parsed) {
            return null;
        }
        const key = `${parsed.major}.${parsed.minor}`;
        const aliased = VersionAliases[key] ? VersionAliases[key] : key;
        return VersionToInfo[aliased] || null;
    }

    static ListSupportedVersions(desc = true) {
        const list = Object.values(VersionToInfo);
        list.sort((a, b) => {
            if (a.major !== b.major) {
                return a.major - b.major;
            }
            return a.minor - b.minor;
        });
        return desc ? list.reverse() : list;
    }

    static GuessVersion(buffer) {
        const candidates = PycReader.ListSupportedVersions(true);
        let best = null;
        for (const candidate of candidates) {
            const trial = PycReader.TryParseMarshal(buffer, candidate);
            if (!trial) {
                continue;
            }
            if (trial.unknown === 0 && trial.remaining === 0) {
                return candidate;
            }
            if (!best ||
                trial.unknownRatio < best.unknownRatio ||
                (trial.unknownRatio === best.unknownRatio && trial.remaining < best.remaining)) {
                best = {...trial, candidate};
            }
        }
        return best ? best.candidate : null;
    }

    static ScanMarshalCandidates(buffer) {
        const candidates = PycReader.ListSupportedVersions(false);
        const results = [];
        for (const candidate of candidates) {
            const trial = PycReader.TryParseMarshal(buffer, candidate);
            if (!trial) {
                continue;
            }
            results.push({...trial, versionInfo: candidate});
        }
        results.sort((a, b) => {
            if (a.unknownRatio !== b.unknownRatio) {
                return a.unknownRatio - b.unknownRatio;
            }
            if (a.remaining !== b.remaining) {
                return a.remaining - b.remaining;
            }
            if (a.unknown !== b.unknown) {
                return a.unknown - b.unknown;
            }
            if (a.versionInfo.major !== b.versionInfo.major) {
                return a.versionInfo.major - b.versionInfo.major;
            }
            return a.versionInfo.minor - b.versionInfo.minor;
        });
        return results;
    }

    static CountUnknownOpcodes(codeObject, reader, opCodeList) {
        const code = codeObject?.Code?.Value;
        if (!code || !opCodeList) {
            return {unknown: Number.MAX_SAFE_INTEGER, total: 0};
        }
        const wordSize = reader.getInstructionWordSize();
        let unknown = 0;
        let total = 0;
        if (wordSize === 2) {
            for (let offset = 0; offset < code.length; offset += 2) {
                total++;
                if (!opCodeList[code[offset]]) {
                    unknown++;
                }
            }
        } else {
            let offset = 0;
            while (offset < code.length) {
                total++;
                const opcode = code[offset];
                const entry = opCodeList[opcode];
                if (!entry) {
                    unknown++;
                    offset += 1;
                    continue;
                }
                offset += entry.HasArgument ? 3 : 1;
            }
        }
        return {unknown, total};
    }

    static TryParseMarshal(buffer, versionInfo) {
        try {
            const reader = new PycReader(buffer, {marshal: true, versionInfo, silent: true});
            const obj = reader.ReadObject();
            if (!obj || obj.ClassName !== "Py_CodeObject") {
                return null;
            }
            const remaining = reader.m_rdr.Reader.length - reader.m_rdr.pc;
            if (remaining < 0) {
                return null;
            }

            const prevDebug = global.g_cliArgs?.debug;
            if (global.g_cliArgs) {
                global.g_cliArgs.debug = false;
            }
            let opcodes = null;
            try {
                opcodes = new versionInfo.opcode(obj);
            } finally {
                if (global.g_cliArgs) {
                    global.g_cliArgs.debug = prevDebug;
                }
            }

            const {unknown, total} = PycReader.CountUnknownOpcodes(obj, reader, opcodes?.OpCodeList);
            const unknownRatio = total > 0 ? unknown / total : 1;

            let score = 0;
            if (remaining === 0) {
                score += 3;
            }
            if (unknown === 0) {
                score += 2;
            }
            if (obj.Code?.Value && Buffer.isBuffer(obj.Code.Value)) {
                score += 1;
            }
            if (obj.Consts?.ClassName === "Py_Tuple") {
                score += 1;
            }
            if (obj.Names?.ClassName === "Py_Tuple") {
                score += 1;
            }
            return {score, remaining, unknown, total, unknownRatio};
        } catch (ex) {
            return null;
        }
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
                    if (charCode === 0) {
                        obj.ClassName = "Py_Null";
                        break;
                    }
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

        const isNewCodeLayout = this.versionCompare(3, 11) >= 0;

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
        } else if (this.versionCompare(2, 3) >= 0 && !isNewCodeLayout) {
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

        // Some fixtures carry malformed code objects (e.g., flags bytes are missing),
        // which misaligns the marshal stream and makes us read code bytes as an unknown type.
        // Heuristic: if the next byte is not a known marshal type but the previous 4th byte is,
        // rewind by 4 bytes (assume flags were absent) so code/consts parsing can proceed.
        const nextType = this.m_rdr.Reader?.[this.m_rdr.pc];
        const prevType = this.m_rdr.pc >= 4 ? this.m_rdr.Reader?.[this.m_rdr.pc - 4] : null;
        if (nextType !== undefined &&
            !KnownTypes.has(String.fromCharCode(nextType & 0x7f)) &&
            prevType !== undefined &&
            KnownTypes.has(String.fromCharCode(prevType & 0x7f))) {
            if (global.g_cliArgs?.debug) {
                console.warn(`[ReadCodeObject] Realigning code object start: rewind 4 bytes (suspect missing flags). pc=${this.m_rdr.pc}`);
            }
            this.m_rdr.pc -= 4;
            codeObject.FlagsMisaligned = true;
        }

        codeObject.codeOffset = this.m_rdr.pc;
        codeObject.Code = this.ReadObject();
        codeObject.Consts = this.ReadObject();

        if (global.g_cliArgs?.debug && this.versionCompare(3, 13) >= 0) {
            console.log(`[ReadCodeObject] name=${codeObject.Name || '?'}, Consts.ClassName=${codeObject.Consts?.ClassName}, Consts.length=${codeObject.Consts?.Value?.length}`);
            if (codeObject.Consts?.Value) {
                for (let i = 0; i < Math.min(3, codeObject.Consts.Value.length); i++) {
                    const c = codeObject.Consts.Value[i];
                    console.log(`  Consts[${i}] = ${c?.ClassName || 'null/undefined'} (${typeof c})`);
                }
            }
        }

        codeObject.Names = this.ReadObject();

        if (isNewCodeLayout) {
            codeObject.LocalsPlusNames = this.ReadObject();
            codeObject.VarKinds = this.ReadObject();
            const {locals, cellVars, freeVars} = this.splitLocalsPlus(codeObject.LocalsPlusNames, codeObject.VarKinds);
            codeObject.VarNames = new PythonObject("Py_Tuple", locals);
            codeObject.CellVars = new PythonObject("Py_Tuple", cellVars);
            codeObject.FreeVars = new PythonObject("Py_Tuple", freeVars);
            codeObject.NumLocals = locals.length;
        } else {
            codeObject.VarNames = this.versionCompare(1, 3) >= 0 ? this.ReadObject() : new PythonObject("Py_Tuple", []);
            codeObject.VarKinds = new PythonObject("Py_String", "");
            codeObject.FreeVars = this.versionCompare(2, 1) >= 0 ? this.ReadObject() : new PythonObject("Py_Tuple", []);
            codeObject.CellVars = this.versionCompare(2, 1) >= 0 ? this.ReadObject() : new PythonObject("Py_Tuple", []);
        }
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
            // Parse exception table into structured format
            codeObject.ExceptionTable = this.ParseExceptionTable(codeObject.exceptTable);
        } else {
            codeObject.exceptTable = new PythonObject("Py_String", "");
            codeObject.ExceptionTable = [];
        }

        return codeObject;
    }

    ParseExceptionTable(exceptTableObject) {
        /**
         * Parse Python 3.11+ exception table format (wordcode units, not delta encoded)
         * Each entry: start, length, target, depth|lasti (all varints)
         */
        if (!exceptTableObject || !exceptTableObject.Value || exceptTableObject.Value.length === 0) {
            return [];
        }

        const data = exceptTableObject.Value;
        const entries = [];
        let pos = 0;

        const decodeVarint = () => {
            // Matches CPython 3.11+ _parse_varint (big-endian 6-bit chunks)
            if (pos >= data.length) {
                return 0;
            }
            let byte = data[pos++];
            let result = byte & 0x3F;
            while (byte & 0x40) {
                if (pos >= data.length) break;
                byte = data[pos++];
                result = (result << 6) | (byte & 0x3F);
            }
            return result;
        };

        while (pos < data.length) {
            const start = decodeVarint() * 2;
            const length = decodeVarint() * 2;
            const end = start + length;
            const targetOffset = decodeVarint() * 2;
            const depthLasti = decodeVarint();
            const depth = depthLasti >> 1;
            const lasti = depthLasti & 1;

            entries.push({ start, end, target: targetOffset, depth, lasti });
        }

        return entries;
    }

    UnpackLineNumbers(codeObject) {
        codeObject.LineNoTab = [];
        let lineno = this.ReadObject();
        codeObject.LineNoTabObject = lineno;
        if (this.versionCompare(3, 11) >= 0) {
            this.UnpackNewLineNumbers(codeObject);
            return;
        }

        if (!lineno || !lineno.Value || lineno.Value.length === 0) {
            const codeLen = codeObject.Code?.Value?.length || 0;
            codeObject.LineNoTab = new Array(codeLen).fill(codeObject.FirstLineNo);
            return;
        }

        let bytePos = 0, currentBytePos = 0;
        let linePos = codeObject.FirstLineNo;
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

    getInstructionWordSize() {
        return this.versionCompare(3, 6) >= 0 ? 2 : 1;
    }

    splitLocalsPlus(localsPlusNames, localsPlusKinds) {
        let locals = [];
        let cellVars = [];
        let freeVars = [];

        if (!localsPlusNames?.Value || !localsPlusKinds?.Value) {
            return {locals, cellVars, freeVars};
        }

        const kindBuffer = Buffer.isBuffer(localsPlusKinds.Value)
            ? localsPlusKinds.Value
            : Buffer.from(localsPlusKinds.Value);

        for (let idx = 0; idx < localsPlusNames.Value.length; idx++) {
            let name = localsPlusNames.Value[idx];
            let kind = kindBuffer[idx] || 0;
            let isLocal = (kind & 0x20) !== 0;
            let isCell = (kind & 0x40) !== 0;
            let isFree = (kind & 0x80) !== 0;

            if (isLocal) {
                locals.push(name);
            }
            if (isCell) {
                cellVars.push(name);
            }
            if (isFree) {
                freeVars.push(name);
            }
        }

        return {locals, cellVars, freeVars};
    }

    scanVarint(buffer, offset) {
        let idx = offset;
        if (idx >= buffer.length) {
            return {value: 0, next: idx};
        }
        let read = buffer[idx++];
        let val = read & 0x3F;
        let shift = 0;
        while ((read & 0x40) && idx < buffer.length) {
            read = buffer[idx++];
            shift += 6;
            val |= (read & 0x3F) << shift;
        }
        return {value: val, next: idx};
    }

    scanSignedVarint(buffer, offset) {
        const {value, next} = this.scanVarint(buffer, offset);
        const signed = (value & 1) ? -(value >> 1) : (value >> 1);
        return {value: signed, next};
    }

    getLineDeltaFromEntry(buffer, offset) {
        const firstByte = buffer[offset];
        const code = (firstByte >> 3) & 0x0F;
        switch (code) {
            case 15: // PY_CODE_LOCATION_INFO_NONE
                return 0;
            case 13: // NO_COLUMNS
            case 14: { // LONG
                const {value} = this.scanSignedVarint(buffer, offset + 1);
                return value;
            }
            case 11: // ONE_LINE1
                return 1;
            case 12: // ONE_LINE2
                return 2;
            default:
                return 0;
        }
    }

    advanceLineTableOffset(buffer, offset) {
        let idx = offset;
        while (idx < buffer.length && (buffer[idx] & 0x80) === 0) {
            idx++;
        }
        return idx;
    }

    UnpackNewLineNumbers(codeObject) {
        const lineTableObj = codeObject.LineNoTabObject;
        const codeBytes = codeObject.Code?.Value || [];
        const wordSize = this.getInstructionWordSize();
        const totalLength = codeBytes.length;
        const lineArray = new Array(totalLength).fill(codeObject.FirstLineNo);

        if (!lineTableObj?.Value || !lineTableObj.Value.length) {
            codeObject.LineNoTab = lineArray;
            return;
        }

        const data = Buffer.isBuffer(lineTableObj.Value)
            ? lineTableObj.Value
            : Buffer.from(lineTableObj.Value);

        let offset = 0;
        let computedLine = codeObject.FirstLineNo;
        let currentStart = 0;
        let currentEnd = 0;
        let lastLine = codeObject.FirstLineNo;

        while (offset < data.length) {
            const firstByte = data[offset];
            if ((firstByte & 0x80) === 0) {
                offset++;
                continue;
            }
            const lineDelta = this.getLineDeltaFromEntry(data, offset);
            computedLine += lineDelta;
            currentStart = currentEnd;
            currentEnd = currentStart + (((firstByte & 0x07) + 1) * wordSize);
            const codeLine = ((firstByte >> 3) & 0x0F) === 0x0F ? lastLine : computedLine;
            for (let idx = currentStart; idx < currentEnd && idx < lineArray.length; idx++) {
                lineArray[idx] = codeLine;
            }
            if (((firstByte >> 3) & 0x0F) !== 0x0F) {
                lastLine = computedLine;
            }
            offset = this.advanceLineTableOffset(data, offset + 1);
        }

        codeObject.LineNoTab = lineArray;
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
