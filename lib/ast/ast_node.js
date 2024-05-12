const OpCodes = require('../OpCodes');

class ASTNode {

    m_parent = null;
    m_lineNo = -1;
    m_processed = false;

    constructor(parent) {
        this.m_parent = parent;
    }

    get line() {
        return this.m_lineNo;
    }

    set line(lineNo) {
        this.m_lineNo = lineNo;
    }

    get lastLine() {
        return this.m_lineNo;
    }

    get processed() {
        return this.m_processed;
    }

    setProcessed() {
        this.m_processed = true;
    }

    toASTString() {
        return JSON.stringify(this, (key, value) => {
            if (["Reader"].includes(key)) {
                return null;
            }
            if (value?.type == "Buffer") {
                return value.toString('ascii');
            }
            if (value && typeof(value) == "object") {
                value.ast_class_name = value.constructor.name;
                return value;
            }
            return value;
        }, 2);
    }
}

class ASTNone extends ASTNode {
    constructor(parent) {
        super(parent);
    }

    get fromAST() {
        return "None";
    }

    toString() {
        return `ASTNone`;
    }
}


class ASTLocals extends ASTNode {
    constructor(parent) {
        super(parent);
    }

    get fromAST() {
        return "";
    }

    toString() {
        return `ASTLocals`;
    }
}

class ASTNodeList extends ASTNode {
    m_list = [];

    constructor(parent, nodes) {
        super(parent);
        this.m_list = nodes;
    }

    get list() {
        return this.m_list;
    }

    get line() {
        return this.m_list[0].line;
    }

    get lastLine() {
        return this.m_list[this.m_list.length - 1].line;
    }

    emptyFunction() {
        return this.list.length == 1 && this.list[0] instanceof ASTReturn && (this.list[0].value == null || this.list[0].value instanceof ASTNone);
    }

    get fromAST() {
        let result = this.list.map(node => node.fromAST).join('\n');
        return result;
    }

    toString() {
        return `ASTNodeList: lines=[${this.line} - ${this.lastLine}], {\n${this.fromAST}\n}`;
    }
}

class ASTChainStore extends ASTNodeList {
    m_src = null;

    constructor(parent, src) {
        super(parent);
        this.m_src = src;
    }

    get source() {
        return this.m_src;
    }

    get line() {
        return this.list[0].line;
    }

    get lastLine() {
        return this.list[this.list.length - 1].line;
    }

    get fromAST() {
        let chain = this.list.map(node => node.fromAST).join(', ');
        let result = `${chain} = ${this.source.fromAST}`;
        
        return result;
    }

    toString() {
        return `ASTChainStore: lines=[${this.line} - ${this.lastLine}], ${this.fromAST}`;
    }
}

class ASTObject extends ASTNode {
    m_obj = null;

    constructor(parent, op) {
        super(parent);
        this.m_obj = op;
    }
    get object() {
        return this.m_obj;
    }

    set object(value) {
        this.m_obj = value;
    }

    get fromAST() {
        let quote = this.object.ClassName == "Py_String" ? "'" : '';
        let result = quote + this.object.toString() + quote;

        return result;
    }

    toString() {
        return `ASTObject: lines=[${this.line} - ${this.lastLine}], ${this.fromAST}`;
    }
}

class ASTUnary extends ASTNode {
    static UnaryOp = {
        Positive: 0,
        Negative: 1,
        Invert: 2,
        Not: 3
    };
    static UnaryOpString = ["+", "-", "~", "!"];

    m_op = null;
    m_operand = null;

    constructor(parent, operand, op) {
        super(parent);
        this.m_op = op;
        this.m_operand = operand;
    }

    get op() {
        return this.m_op;
    }

    get operand() {
        return this.m_operand;
    }

    get fromAST() {
        let result = `${ASTUnary.UnaryOpString[this.op]}${this.operand.fromAST}`;

        return result;
    }

    toString() {
        return `ASTUnary: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTBinary extends ASTNode {
    static BinOp = {
        Attr: 0,
        Power: 1,
        Multiply: 2,
        Divide: 3,
        FloorDivide: 4,
        Modulo: 5,
        Add: 6,
        Subtract: 7,
        LeftShift: 8,
        RightShift: 9,
        And: 10,
        Xor: 11,
        Or: 12,
        LogicalAnd: 13,
        LogicalOr: 14,
        MatrixMultiply: 15,
        InplaceAdd: 16,
        InplaceSubtract: 17,
        InplaceMultiply: 18,
        InplaceDivide: 19,
        InplaceModulo: 20,
        InplacePower: 21,
        InplaceLeftShift: 22,
        InplaceRightShift: 23,
        InplaceAnd: 24,
        InplaceXor: 25,
        InplaceOr: 26,
        InplaceFloorDivide: 27,
        InplaceMatrixMultiply: 28,
        InvalidOp: 29
    };

    m_op = null;
    m_left = null;
    m_right = null;

    constructor(parent, left, right, op) {
        super(parent);
        this.m_left = left;
        this.m_right =right;
        this.m_op = op;
    }

    get left() {
        return this.m_left;
    }
    get right() {
        return this.m_right;
    }
    get op() {
        return this.m_op;
    }

    get isInplace() {
        return this.m_op >= ASTBinary.BinOp.InplaceAdd;
    }

    op_str()
    {
        return [
            ".", " ** ", " * ", " / ", " // ", " % ", " + ", " - ",
            " << ", " >> ", " & ", " ^ ", " | ", " and ", " or ", " @ ",
            " += ", " -= ", " *= ", " /= ", " %= ", " **= ", " <<= ",
            " >>= ", " &= ", " ^= ", " |= ", " //= ", " @= ", " <INVALID> "
        ][this.op];
    }

    static from_opcode(opcode)
    {
        switch (opcode) {
        case OpCodes.BINARY_ADD:
            return ASTBinary.BinOp.Add;
        case OpCodes.BINARY_AND:
            return ASTBinary.BinOp.And;
        case OpCodes.BINARY_DIVIDE:
            return ASTBinary.BinOp.Divide;
        case OpCodes.BINARY_FLOOR_DIVIDE:
            return ASTBinary.BinOp.FloorDivide;
        case OpCodes.BINARY_LSHIFT:
            return ASTBinary.BinOp.LeftShift;
        case OpCodes.BINARY_MODULO:
            return ASTBinary.BinOp.Modulo;
        case OpCodes.BINARY_MULTIPLY:
            return ASTBinary.BinOp.Multiply;
        case OpCodes.BINARY_OR:
            return ASTBinary.BinOp.Or;
        case OpCodes.BINARY_POWER:
            return ASTBinary.BinOp.Power;
        case OpCodes.BINARY_RSHIFT:
            return ASTBinary.BinOp.RightShift;
        case OpCodes.BINARY_SUBTRACT:
            return ASTBinary.BinOp.Subtract;
        case OpCodes.BINARY_TRUE_DIVIDE:
            return ASTBinary.BinOp.Divide;
        case OpCodes.BINARY_XOR:
            return ASTBinary.BinOp.Xor;
        case OpCodes.BINARY_MATRIX_MULTIPLY:
            return ASTBinary.BinOp.MatrixMultiply;
        case OpCodes.INPLACE_ADD:
            return ASTBinary.BinOp.InplaceAdd;
        case OpCodes.INPLACE_AND:
            return ASTBinary.BinOp.InplaceAnd;
        case OpCodes.INPLACE_DIVIDE:
            return ASTBinary.BinOp.InplaceDivide;
        case OpCodes.INPLACE_FLOOR_DIVIDE:
            return ASTBinary.BinOp.InplaceFloorDivide;
        case OpCodes.INPLACE_LSHIFT:
            return ASTBinary.BinOp.InplaceLeftShift;
        case OpCodes.INPLACE_MODULO:
            return ASTBinary.BinOp.InplaceModulo;
        case OpCodes.INPLACE_MULTIPLY:
            return ASTBinary.BinOp.InplaceMultiply;
        case OpCodes.INPLACE_OR:
            return ASTBinary.BinOp.InplaceOr;
        case OpCodes.INPLACE_POWER:
            return ASTBinary.BinOp.InplacePower;
        case OpCodes.INPLACE_RSHIFT:
            return ASTBinary.BinOp.InplaceRightShift;
        case OpCodes.INPLACE_SUBTRACT:
            return ASTBinary.BinOp.InplaceSubtract;
        case OpCodes.INPLACE_TRUE_DIVIDE:
            return ASTBinary.BinOp.InplaceDivide;
        case OpCodes.INPLACE_XOR:
            return ASTBinary.BinOp.InplaceXor;
        case OpCodes.INPLACE_MATRIX_MULTIPLY:
            return ASTBinary.BinOp.InplaceMatrixMultiply;
        default:
            return ASTBinary.InvalidOp;
        }
    } 
    
    static from_binary_op(operand)
    {
        switch (operand) {
            case 0:
                return ASTBinary.BinOp.Add;
            case 1:
                return ASTBinary.BinOp.And;
            case 2:
                return ASTBinary.BinOp.FloorDivide;
            case 3:
                return ASTBinary.BinOp.LeftShift;
            case 4:
                return ASTBinary.BinOp.MatrixMultiply;
            case 5:
                return ASTBinary.BinOp.Multiply;
            case 6:
                return ASTBinary.BinOp.Modulo;
            case 7:
                return ASTBinary.BinOp.Or;
            case 8:
                return ASTBinary.BinOp.Power;
            case 9:
                return ASTBinary.BinOp.RightShift;
            case 10:
                return ASTBinary.BinOp.Subtract;
            case 11:
                return ASTBinary.BinOp.Divide;
            case 12:
                return ASTBinary.BinOp.Xor;
            case 13:
                return ASTBinary.BinOp.InplaceAdd;
            case 14:
                return ASTBinary.BinOp.InplaceAnd;
            case 15:
                return ASTBinary.BinOp.InplaceFloorDivide;
            case 16:
                return ASTBinary.BinOp.InplaceLeftShift;
            case 17:
                return ASTBinary.BinOp.MatrixMultiply;
            case 18:
                return ASTBinary.BinOp.InplaceMultiply;
            case 19:
                return ASTBinary.BinOp.InplaceModulo;
            case 20:
                return ASTBinary.BinOp.InplaceOr;
            case 21:
                return ASTBinary.BinOp.InplacePower;
            case 22:
                return ASTBinary.BinOp.InplaceRightShift;
            case 23:
                return ASTBinary.BinOp.InplaceSubtract;
            case 24:
                return ASTBinary.BinOp.InplaceDivide;
            case 25:
                return ASTBinary.BinOp.InplaceXor;
            default:
                return ASTBinary.BinOp.InvalidOp; // Return BIN_INVALID for out-of-range operand
        }
    }

    get fromAST() {
        let result = `${this.left.fromAST}${this.op_str()}${this.right.fromAST}`;

        return result;
    }

    toString() {
        return `ASTBinary: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTCompare extends ASTBinary {
    static CompareOp = {
        Less: 0,
        LessEqual: 1,
        Equal: 2,
        NotEqual: 3,
        Greater: 4,
        GreaterEqual: 5,
        In: 6,
        NotIn: 7,
        Is: 8,
        IsNot: 9,
        Exception: 10,
        Bad: 11
    };

    constructor(parent, left, right, op) {
        super(parent, left, right, op);
    }

    get isInplace() {
        return false;
    }

    op_str()
    {
        return [
            " < ", " <= ", " == ", " != ", " > ", " >= ", " in ", " not in ",
            " is ", " is not ", "<EXCEPTION MATCH>", "<BAD>"
            ][this.op];
    }

    get fromAST() {
        let result = `${this.left.fromAST}${this.op_str()}${this.right.fromAST}`;

        return result;
    }

    toString() {
        return `ASTCompare: line=${this.line}, ${this.fromAST}`;
    }}

class ASTSlice extends ASTBinary {
    static SliceOp = {
        Slice0: 0,
        Slice1: 1,
        Slice2: 2,
        Slice3: 3
    };

    constructor(parent, op, left, right) {
        super(parent, left, right, op);
    }

    get isInplace() {
        return false;
    }

    get fromAST() {
        let str = '';

        switch (this.op) {
            case ASTSlice.SliceOp.Slice0:
                str = '[:]';
                break;
            case ASTSlice.SliceOp.Slice1:
                str = `[${this.left.fromAST}:]`;
                break;
            case ASTSlice.SliceOp.Slice2:
                str = `[:${this.right.fromAST}]`;
                break;
            case ASTSlice.SliceOp.Slice3:
                str = `[${this.left.fromAST}:${this.right.fromAST}]`;
                break;
            default:
                console.error(`Slice op ${this.op} is not defined.`);
                break;
        }
        return str;
    }

    toString() {
        return `ASTSlice: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTStore extends ASTNode {

    m_src = null;
    m_dest = null;

    constructor(parent, src, dest) {
        super(parent);
        this.m_src = src;
        this.m_dest = dest;
    }

    get src() {
        return this.m_src;
    }

    get dest() {
        return this.m_dest;
    }
    get fromAST() {
        let result;

        if (this.src instanceof ASTFunction) {
            result = '# TODO: ASTFunction';
        } else if (this.src instanceof ASTClass) {
            result = '# TODO: ASTClass';
        } else {
            result = `${this.dest.fromAST} = ${this.src.fromAST}`;
        }

        return result;
    }

    toString() {
        return `ASTStore: line=${this.line}, ${this.fromAST}`;
    }
}


class ASTReturn extends ASTNode {
    static RetType = {
        Return: 0,
        Yield: 1,
        YieldFrom: 2
    };

    m_value = null;
    m_rettype = ASTReturn.RetType.Return;
    m_inlambda = false;

    constructor(parent, value, rettype = ASTReturn.RetType.Return) {
        super(parent);
        this.m_value = value;
        this.m_rettype = rettype;
    }

    get value() {
        return this.m_value;
    }

    get rettype() {
        return this.m_rettype;
    }

    get inLambda() {
        return this.m_inlambda;
    }

    set inLambda(value) {
        this.m_inlambda = value;
    }

    get fromAST() {
        let result;

        if (!this.inLambda) {
            switch (this.rettype) {
                case ASTReturn.RetType.Return:
                    result = `return ${this.value.fromAST}`;
                    break;
                case ASTReturn.RetType.Yield:
                    result = `yield ${this.value.fromAST}`;
                    break;
                case ASTReturn.RetType.YieldFrom:
                    if (this.value instanceof ASTAwaitable) {
                        result = `await ${this.expression.fromAST}`;
                    } else {
                        result = `yield from ${this.value.fromAST}`;
                    }
                    break;
            }
            return result;
        }

        return result;
    }

    toString() {
        return `${this.constructor.name}: line=${this.line}, ${this.fromAST}`;
    }
}


class ASTName extends ASTNode {
    m_name = null;

    constructor(parent, name) {
        super(parent);
        this.m_name = name;
    }

    get name() {
        return this.m_name;
    }


    get fromAST() {
        return this.name.toString();
    }

    toString() {
        return `${this.constructor.name}: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTDelete extends ASTNode {
    m_value = null;

    constructor(parent, value, rettype) {
        super(parent);
        this.m_value = value;
    }

    get value() {
        return this.m_value;
    }

    get fromAST() {
        let result = `del ${this.value.fromAST}`;

        return result;
    }

    toString() {
        return `${this.constructor.name}: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTFunction extends ASTNode {
    m_code = null;
    m_defargs = null;
    m_kwdefargs = null;

    constructor(parent, code, defargs = [], kwdefargs = []) {
        super(parent);
        this.m_code = code;
        this.m_defargs = defargs;
        this.m_kwdefargs = kwdefargs;
    }

    get code() {
        return this.m_code;
    }

    get defargs() {
        return this.m_defargs;
    }

    get kwdefargs() {
        return this.m_kwdefargs;
    }

    get line() {
        return this.code.line;
    }

    get lastLine() {
        return this.code.lastLine;
    }

    get fromAST() {
        let result = `#TODO ${this.constructor.name} ${this.code.fromAST}`;

        return result;
    }

    toString() {
        return `${this.constructor.name}: lines=[${this.line} - ${this.lastLine}], ${this.fromAST}`;
    }
}

class ASTClass extends ASTNode {
    m_code = null;
    m_bases = null;
    m_name = null;

    constructor(parent, code, bases, name) {
        super(parent);
        this.m_code = code;
        this.m_bases = bases;
        this.m_name = name;
    }

    get code() {
        return this.m_code;
    }

    get bases() {
        return this.m_bases;
    }

    get name() {
        return this.m_name;
    }

    get line() {
        return this.code.line;
    }

    get lastLine() {
        return this.code.lastLine;
    }

    get fromAST() {
        let result = `#TODO ${this.constructor.name} ${this.code.fromAST}`;

        return result;
    }

    toString() {
        return `${this.constructor.name}: lines=[${this.line} - ${this.lastLine}], ${this.fromAST}`;
    }
}

class ASTCall extends ASTNode {
    m_func = null;
    m_pparams = null;
    m_kwparams = null;
    m_var = null;
    m_kw = null;

    constructor(parent, func, pparams, kwparams) {
        super(parent);
        this.m_func = func;
        this.m_pparams = pparams;
        this.m_kwparams = kwparams;
    }

    get func() {
        return this.m_func;
    }

    get pparams() {
        return this.m_pparams;
    }

    get kwparams() {
        return this.m_kwparams;
    }

    get var() {
        return this.m_var;
    }

    set var(value) {
        this.m_var = value;
    }

    set kw(value) {
        this.m_kw = value;
    }

    get hasVar() {
        return this.m_var != null;
    }

    get hasKw() {
        return this.m_kw != null;
    }


    get fromAST() {
        let result = `${this.func.fromAST}(`;
        let params = [];
        if (this.pparams.length > 0) {
            params.push(this.pparams.map(node => node.fromAST).join(', '));
        }
        if (this.kwparams.length > 0) {
            params.push(this.kwparams.map(node => `${node.key.fromAST} = ${node.value.fromAST}`).join(', '));
        }
        if (this.hasVar) {
            params.push('*' +this.var.fromAST);
        }
        if (this.hasKw) {
            params.push('**' +this.kw.fromAST);
        }
        result += params.join(', ') + ')';
        return result;
    }

    toString() {
        return `${this.constructor.name}: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTImport extends ASTNode {
    m_name = null;
    m_alias = null;
    m_stores = [];
    m_fromlist = null;

    constructor(parent, name, fromlist, alias = null) {
        super(parent);
        this.m_name = name;
        this.m_fromlist = fromlist;
        this.m_alias = alias;
    }

    get name() {
        return this.m_name;
    }

    get alias() {
        return this.m_alias;
    }

    set alias(alias) {
        this.m_alias = alias;
    }

    get stores() {
        return this.m_stores;
    }

    get fromlist() {
        return this.m_fromlist;
    }

    add_store(store) {
        this.stores.push(store);
    }

    get fromAST() {
        let result;

        if (!this.stores.empty()) {
            result = `from ${this.name instanceof ASTImport ? this.name.name.fromAST : this.name.fromAST} import `;
            result += this.stores.map(el => `${el.src.fromAST}${el.src.fromAST != el.dest.fromAST ? ' as ' + el.dest.fromAST : ''}`).join(', ');
        } else {
            result = `import ${this.name.fromAST}`;
            if (this.name.fromAST != this.alias?.fromAST) {
                result += ` as ${this.alias?.fromAST}`;
            }
        }

        return result;
    }

    toString() {
        return `ASTImport: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTTuple extends ASTNode {
    m_values = [];
    m_requireParens = true;

    constructor(parent, values) {
        super(parent);
        this.m_values = values;
    }

    get values() {
        return this.m_values;
    }

    get requireParens() {
        return this.m_requireParens;
    }

    set requireParens(value) {
        this.m_requireParens = value;
    }

    add(name) {
        this.values.push(name);
    }

    get fromAST() {
        let openParen = '', closeParen = '';

        if (this.requireParens) {
            openParen = '(';
            closeParen = ')';
        }

        let result = openParen + this.values.map(node => node.fromAST).join(', ') + closeParen;

        return result;
    }

    toString() {
        return `ASTTuple: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTList extends ASTNode {
    m_values = [];

    constructor(parent, values) {
        super(parent);
        this.m_values = values;
    }

    get values() {
        return this.m_values;
    }

    get line() {
        return this.values[0]?.line;
    }

    get lastLine() {
        return this.values[this.values.length - 1]?.lastLine;
    }

    get fromAST() {
        let result = '[' + this.values.map(node => node.fromAST).join(', ') + ']';

        return result;
    }

    toString() {
        return `ASTList: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTSet extends ASTNode {
    m_values = [];

    constructor(parent, values) {
        super(parent);
        this.m_values = values;
    }

    get values() {
        return this.m_values;
    }

    get line() {
        return this.values[0]?.lastLine;
    }

    get lastLine() {
        return this.values[this.values.length - 1]?.lastLine;
    }

    add(value) {
        // TODO: Should we validate uniqueness of the value?
        this.values.push(value);
    }

    get fromAST() {
        let result = '{' + this.values.map(node => node.fromAST).join(', ') + '}';

        return result;
    }

    toString() {
        return `ASTSet: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTMap extends ASTNode {
    m_values = [];

    constructor(parent, values) {
        super(parent);
        this.m_values = values || [];
    }

    get values() {
        return this.m_values;
    }

    get lastLine() {
        let keys = Object.keys(this.values);
        return keys[keys.length - 1]?.lastLine;
    }

    add (key, value) {
        this.values.push({key, value});
    }

    get fromAST() {
        let result = '{' + this.values.map(el => el.key.fromAST + ': ' + el.value.fromAST).join(', ') + '}';

        return result;
    }

    toString() {
        return `ASTMap: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTKwNamesMap extends ASTNode {
    m_values = [];

    constructor(parent, values) {
        super(parent);
        this.m_values = values;
    }

    get values() {
        return this.m_values;
    }

    get lastLine() {
        let keys = Object.keys(this.values);
        return keys[keys.length - 1]?.lastLine;
    }

    add (key, value) {
        this.values.push({key, value});
    }

    get fromAST() {
        let result = '{' + this.values.map(el => el.key.fromAST + ': ' + el.value.fromAST).join(', ') + '}';

        return result;
    }

    toString() {
        return `ASTKwNamesMap: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTConstMap extends ASTNode {
    m_keys = {};
    m_values = {};

    constructor(parent, keys, values) {
        super(parent);
        this.m_keys = keys;
        this.m_values = values;
    }

    get values() {
        return this.m_values;
    }

    get keys() {
        return this.m_keys;
    }

    get lastLine() {
        return this.keys[this.keys.length - 1]?.lastLine;
    }

    get fromAST() {
        let result = '# TODO: ASTConstMap';

        return result;
    }

    toString() {
        return `ASTConstMap: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTSubscr extends ASTNode {
    m_name = null;
    m_key = null;

    constructor(parent, name, key) {
        super(parent);
        this.m_name = name;
        this.m_key = key;
    }

    get name() {
        return this.m_name;
    }

    get key() {
        return this.m_key;
    }

    get lastLine() {
        return this.key?.lastLine || -1;
    }

    get fromAST() {
        let result = `${this.name.fromAST}[${this.key.fromAST}]`;

        return result;
    }

    toString() {
        return `ASTSubscr: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTPrint extends ASTNode {
    m_values = [];
    m_stream = null;
    m_eol = false;

    constructor(parent, value, stream) {
        super(parent);
        
        this.m_stream = stream;

        if (value) {
            this.m_values.push(value);
            this.m_eol = false;
        } else {
            this.m_eol = true;
        }
    }

    get values() {
        return this.m_values;
    }

    get eol() {
        return this.m_eol;
    }

    set eol(eol) {
        this.m_eol = eol;
    }

    get lastLine() {
        return this.values[this.values.length - 1]?.lastLine;
    }

    add (key, value) {
        this.values.push(value);
    }

    get fromAST() {
        let result = `print `;

        if (this.stream) {
            result += ` >> ${this.stream.fromAST}`;
        }

        result += this.values.map(node => node.fromAST).join(', ') + (this.eol ? ',' : '');

        return result;
    }

    toString() {
        return `ASTPrint: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTConvert extends ASTNode {
    m_name = null;

    constructor(parent, name) {
        super(parent);
        this.m_name = name;
    }

    get name() {
        return this.m_name;
    }

    get fromAST() {
        let result = "`" + this.name.fromAST +"`";

        return result;
    }

    toString() {
        return `ASTPrint: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTKeyword extends ASTNode {
    static Word = {
        Pass: 0,
        Break: 1,
        Continue: 2
    }
    
    m_key = null;

    constructor(parent, key) {
        super(parent);
        this.m_key = key;
    }

    get key() {
        return this.m_key;
    }

    get word() {
        return ["pass", "break", "continue"][this.key];
    }

    get fromAST() {
        let result = this.word;
        return result;
    }

    toString() {
        return `ASTKeyword: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTRaise extends ASTNode {
    m_params = [];

    constructor(parent, params) {
        super(parent);
        this.m_params = params;
    }

    get params() {
        return this.m_params;
    }

    get lastLine() {
        return this.params[this.params.length - 1]?.lastLine;
    }

    get fromAST() {
        let result = 'raise ' + this.params.map(node => node.fromAST).join(', ');
        return result;
    }

    toString() {
        return `ASTRaise: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTExec extends ASTNode {
    m_stmt = null;
    m_glob = null;
    m_loc = null;

    constructor(parent, stmt, glob, loc) {
        super(parent);
        this.m_stmt = stmt;
        this.m_glob = glob;
        this.m_loc = loc;
    }

    get statement() {
        return this.m_stmt;
    }

    get globals() {
        return this.m_glob;
    }

    get locals() {
        return this.m_loc;
    }

    get fromAST() {
        let result = `exec ${this.statement.fromAST}`;

        if (this.globals) {
            result += ` in ${this.globals.fromAST}`;
            if (this.locals && this.globals.fromAST != this.locals.fromAST) {
                result += `, ${this.locals}`;
            }
        }
        return result;
    }

    toString() {
        return `ASTRaise: line=${this.line}, ${this.fromAST}`;
    }
}

class ASTBlock extends ASTNode {
    static BlockType = {
        Main: 0,
        If: 1,
        Else: 2,
        Elif: 3,
        Try: 4,
        Container: 5,
        Except: 6,
        Finally: 7,
        While: 8,
        For: 9,
        With: 10,
        AsyncFor: 11
    }
    
    m_blockType = ASTBlock.BlockType.Main;
    m_nodes = [];
    m_start = 0;
    m_end = 0;
    m_inited = 0;

    constructor(parent, blockType, start = 0, end = 0, inited = 0) {
        super(parent);
        this.m_blockType = blockType;
        this.m_start = start;
        this.m_end = end;
        this.m_inited = inited;
    }

    get blockType() {
        return this.m_blockType;
    }

    get nodes() {
        return this.m_nodes;
    }

    get size() {
        return this.m_nodes.length;
    }

    get start() {
        return this.m_start;
    }
    
    set start(value) {
        this.m_start = value;
    }

    get end() {
        return this.m_end;
    }
    
    set end(value) {
        this.m_end = value;
    }

    get nodes() {
        return this.m_nodes;
    }

    get inited() {
        return this.m_inited;
    }

    get lastLine() {
        return this.params[this.params.length - 1]?.lastLine || -1;
    }

    get type_str() {
        return [
            "", "if", "else", "elif", "try", "CONTAINER", "except",
            "finally", "while", "for", "with", "async for"
        ][this.blockType];
    }

    init(value = 1) {
        this.m_inited = value;
    }

    removeFirst() {
        this.nodes.shift();
    }

    removeLast() {
        this.nodes.length--;
    }

    append(node) {
        this.nodes.push(node);
    }

    empty() {
        return this.nodes.length == 0;
    }
    
    get fromAST() {
        let result;

        if (this.blockType == ASTBlock.BlockType.Else && this.nodes.empty()) {
            return "";
        }
        
        result = this.type_str + ":\n";

        if (!this.nodes.empty()) {
            result += this.nodes.map(node => node.fromAST).join("\n");
            return result;
        } else {
            return "pass";
        }
    }

    toString() {
        return `${this.type_str} block: {${this.start} - ${this.end}}`;
    }
}

class ASTCondBlock extends ASTBlock {
    static InitCondition = {
        Uninited: 0,
        Popped: 1,
        PrePopped: 2
    }

    m_cond = null;
    m_negative = false;

    constructor(parent, blockType, start = 0, end = 0, cond, negative) {
        super(parent, blockType, start, end);
        this.m_cond = cond;
        this.m_negative = negative;
    }

    get condition() {
        return this.m_cond;
    }

    set condition(cond) {
        this.m_cond = cond;
    }

    get negative() {
        return this.m_negative;
    }

    set negative(neg) {
        this.m_negative = neg;
    }
    
    get fromAST() {
        let result;

        result = this.type_str;
        if ([ASTBlock.BlockType.If, ASTBlock.BlockType.Elif, ASTBlock.BlockType.While].includes(this.blockType)) {
            result += `${this.negative ? " not" : ""} ${this.condition.fromAST}`;
        } else if ([ASTBlock.BlockType.Except].includes(this.blockType) && this.condition) {
            result += ` ${this.condition.fromAST}`;
        }

        result += ":\n" + this.nodes.map(node => node.fromAST).join("\n");
        
        return result;
    }

    toString() {
        return `${this.type_str} block: {${this.start} - ${this.end}}`;
    }
}

class ASTIterBlock extends ASTBlock {

    m_iter = null;
    m_idx = null;
    m_cond = null;
    m_comp = false;

    constructor(parent, blockType, start = 0, end = 0, iter) {
        super(parent, blockType, start, end);
        this.m_iter = iter;
    }
    
    get start() {
        return this.m_start;
    }

    get iter() {
        return this.m_iter;
    }
    
    get index() {
        return this.m_idx;
    }

    set index(value) {
        this.m_idx = value;
    }

    get condition() {
        return this.m_cond;
    }
    
    set condition(value) {
        this.m_cond = value;
    }

    get comprehension() {
        return this.m_comp;
    }
    
    set comprehension(value) {
        this.m_comp = value;
    }
    
    get fromAST() {
        let result;

         if ([ASTBlock.BlockType.For, ASTBlock.BlockType.AsyncFor].includes(this.blockType)) {
            result += ` ${this.index.fromAST} in ${this.iter.fromAST}`;
        }

        result += ":\n" + this.nodes.map(node => node.fromAST).join("\n");
        
        return result;
    }

    toString() {
        return `${this.type_str} block: {${this.start} - ${this.end}}`;
    }
}

class ASTContainerBlock extends ASTBlock {

    m_finally = 0;
    m_except = 0;

    constructor(parent, start = 0, _finally, except = 0) {
        super(parent, ASTBlock.BlockType.Container, start);
        this.m_finally = _finally;
        this.m_except = except;
    }

    get finally() {
        return this.m_finally;
    }

    get hasFinally() {
        return !!this.m_finally;
    }
    
    get except() {
        return this.m_except;
    }

    set except(value) {
        this.m_except = !!value;
    }

    get hasExcept() {
        return !!this.m_except;
    }
    
    get fromAST() {
        let result = '# TODO: ASTContinerBlock';

        return result;
    }

    toString() {
        return `${this.type_str} block: {${this.start} - ${this.end}}`;
    }
}

class ASTWithBlock extends ASTBlock {

    m_expr = null;
    m_var = null;

    constructor(parent, start = 0, end = 0) {
        super(parent, ASTBlock.BlockType.With, start, end);
    }
    
    get expr() {
        return this.m_expr;
    }

    set expr(value) {
        this.m_expr = !!value;
    }
    
    get var() {
        return this.m_var;
    }

    set var(value) {
        this.m_var = !!value;
    }
    
    get fromAST() {
        let result;

         if ([ASTBlock.BlockType.With].includes(this.blockType)) {
            result += ` ${this.expression.fromAST}`;
            if (this.var) {
                result += ` as ${this.var.fromAST}`
            }
        }

        result += ":\n" + this.nodes.map(node => node.fromAST).join("\n");
        
        return result;
    }

    toString() {
        return `${this.type_str} block: {${this.start} - ${this.end}}`;
    }
}

class ASTComprehension extends ASTNode {

    m_result = null;
    m_generators = [];

    constructor(parent, result) {
        super(parent);
        this.m_result = result;
    }
    
    get result() {
        return this.m_result;
    }

    get generators() {
        return this.m_generators;
    }

    get lastLine() {
        return this.generators[this.generators.length - 1]?.lastLine;
    }

    addGenerator(generator) {
        this.generators.unshift(generator);
    }
    
    get fromAST() {
        let result = `[${this.result.fromAST}`;

        result += ":\n" + this.generators.map(gen => {
            let genString = ` for ${gen.index.fromAST} in ${gen.iter.fromAST}`;

            if (gen.condition) {
                genString += ` if ${gen.condition.fromAST}`;
            }

            return genString;
        }).join("") + " ]";
        
        return result;
    }

    toString() {
        return `ASTComprehension: {${this.start} - ${this.end}}, ${this.fromAST}`;
    }
}

class ASTLoadBuildClass extends ASTNode {

    m_obj = null;

    constructor(parent, obj) {
        super(parent);
        this.m_obj = obj;
    }
    
    get object() {
        return this.m_obj;
    }

    get fromAST() {
        return "";
    }

    toString() {
        return `ASTLoadBuildClass: [${this.line} - ${this.lastLine}], ${this.fromAST}`;
    }
}

class ASTAwaitable extends ASTNode {

    m_expr = null;

    constructor(parent, expr) {
        super(parent);
        this.m_expr = expr;
    }
    
    get expression() {
        return this.m_expr;
    }

    get fromAST() {
        return "";
    }

    toString() {
        return `ASTAwaitable: [${this.line} - ${this.lastLine}], ${this.fromAST}`;
    }
}

class ASTFormattedValue extends ASTNode {
    static ConversionFlag = {
        None: 0,
        Str: 1,
        Repr: 2,
        ASCII: 3,
        FmtSpec: 4
    }

    m_val = null;
    m_conversion = null;
    m_format_spec = null;

    constructor(parent, val, conversion, format_spec) {
        super(parent);
        this.m_val = val;
        this.m_conversion = conversion;
        this.m_format_spec = format_spec;
    }
    
    get val() {
        return this.m_val;
    }
    
    get conversion() {
        return this.m_conversion;
    }
    
    get format_spec() {
        return this.m_format_spec;
    }
    
    get fromAST() {
        return "";
    }

    toString() {
        return `${this.constructor.name}: Line ${this.line}, ${this.fromAST}`;
    }
}

class ASTJoinedStr extends ASTNode {
    m_values = null;

    constructor(parent, values) {
        super(parent);
        this.m_values = values;
    }
    
    get values() {
        return this.m_values;
    }

    get lastLine() {
        return this.values[this.values.length - 1]?.lastLine;
    }
    get fromAST() {
        return "";
    }

    toString() {
        return `${this.constructor.name}: Line ${this.line}, ${this.fromAST}`;
    }
}

class ASTAnnotatedVar extends ASTNode {
    m_name = null;
    m_type = null;

    constructor(parent, name, type) {
        super(parent);
        this.m_name = name;
        this.m_type = type;
    }
    
    get name() {
        return this.m_name;
    }

    get annotation() {
        return this.m_type;
    }

    get fromAST() {
        return "";
    }

    toString() {
        return `${this.constructor.name}: Line ${this.line}, ${this.fromAST}`;
    }
}

class ASTTernary extends ASTNode {
    m_if_block = null;
    m_if_expr = null;
    m_else_expr = null;
    constructor(parent, if_block, if_expr, else_expr) {
        super(parent);
        this.m_if_block = if_block;
        this.m_if_expr = if_expr;
        this.m_else_expr = else_expr;
    }
    
    get if_block() {
        return this.m_if_block;
    }

    get if_expr() {
        return this.m_if_expr;
    }

    get else_expr() {
        return this.m_else_expr;
    }

    get lastLine() {
        return this.else_expr?.lastLine;
    }

    get fromAST() {
        let result = `${this.if_expr.fromAST} if ${this.if_block.negative ? "not " : ""} ${this.if_block.condition.fromAST} else ${this.else_expr.fromAST}`;
        return result;
    }

    toString() {
        return `${this.constructor.name}: Line ${this.line}, ${this.fromAST}`;
    }}

module.exports = {
    ASTNode,
    ASTNone,
    ASTLocals,
    ASTNodeList,
    ASTChainStore,
    ASTObject,
    ASTUnary,
    ASTBinary,
    ASTCompare,
    ASTSlice,
    ASTStore,
    ASTReturn,
    ASTName,
    ASTDelete,
    ASTFunction,
    ASTClass,
    ASTCall,
    ASTImport,
    ASTTuple,
    ASTList,
    ASTSet,
    ASTMap,
    ASTKwNamesMap,
    ASTConstMap,
    ASTSubscr,
    ASTPrint,
    ASTConvert,
    ASTKeyword,
    ASTRaise,
    ASTExec,
    ASTBlock,
    ASTCondBlock,
    ASTIterBlock,
    ASTContainerBlock,
    ASTWithBlock,
    ASTComprehension,
    ASTLoadBuildClass,
    ASTAwaitable,
    ASTFormattedValue,
    ASTJoinedStr,
    ASTAnnotatedVar,
    ASTTernary
};

// Registering classes in global scope for propoer class deserialization.
for (let className of Object.keys(module.exports)) {
    global[className] = new module.exports[className]();
}
