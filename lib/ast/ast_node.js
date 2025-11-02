const OpCodes = require('../OpCodes');
const PycResult = require('../PycResult');

const SPACES_PER_LEVEL = 4;

function indent(level = 1) {
    return Buffer.alloc(level * SPACES_PER_LEVEL, ' ').toString('ascii');
}

class ASTNode {

    m_lineNo = -1;
    m_prevSibling = null;
    m_nextSibling = null;
    m_skip = false;
    
    get line() {
        return this.m_lineNo;
    }

    set line(lineNo) {
        this.m_lineNo = lineNo;
    }

    get lastLine() {
        return this.m_lineNo;
    }

    get prevSibling() {
        return this.m_prevSibling;
    }

    set prevSibling(value) {
        this.m_prevSibling = value;
    }

    get nextSibling() {
        return this.m_nextSibling;
    }

    set nextSibling(value) {
        this.m_nextSibling = value;
    }

    get skip() {
        return this.m_skip;
    }

    set skip(value) {
        this.m_skip = value;
    }

    codeFragment() {
        let result = `#TODO ${this.constructor.name}`;
        return result;
    }

    static calculateSpacing(prevNode, node) {
        if (node?.key) {
            prevNode = prevNode?.key;
            node = node.key;
        }
        if (!prevNode || prevNode.lastLine == node.line) {
            return 0;
        } else {
            let prevLine = prevNode.lastLine > -1 ? prevNode.lastLine : (node?.line || -1) - 1;
            let line = (node?.lastLine || -1) > -1 ? (node?.lastLine || -1) : prevLine > -1 ? prevLine + 1 : 1;
            let delta = line - prevLine;
            if (delta > 2) {
                delta = 2;
            }
            return delta;
        }
    }

    static renderList(list, openBracket, closeBracket, callback) {
        let result = new PycResult(openBracket, true);
        result.increaseIndent();
        let prevNode = null;

        for (let node of list) {
            let sourceFragment = callback ? callback(node) : (node?.codeFragment() || "##ERROR##");
            let spacing = ASTNode.calculateSpacing(prevNode, node);

            if (spacing == 0) {
                result.lastLineAppend((prevNode ? " " : "") + sourceFragment + ",", false)
            } else {
                if (spacing > 1) {
                    result.add("");
                }
                result.add(sourceFragment + ",");
            }

            prevNode = node;
        }
        result.chop(",");
        result.lastLineAppend(closeBracket);

        return result;
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
    m_override = null;
    constructor(override) {
        super();
        if (override) {
            this.m_override = override;
        }
    }

    codeFragment() {
        return this.m_override !== null ? this.m_override : "None";
    }

    toString() {
        return `ASTNone`;
    }
}


class ASTLocals extends ASTNode {
    constructor() {
        super();
    }

    codeFragment() {
        return "";
    }

    toString() {
        return `ASTLocals`;
    }
}

class ASTNodeList extends ASTNode {
    m_list = [];

    constructor(nodes) {
        super();
        this.m_list = nodes || [];
    }

    get list() {
        return this.m_list;
    }

    get line() {
        return this.m_list[0].line;
    }

    get last() {
        return this.list[this.list.length - 1];
    }

    get lastLine() {
        return this.last.line;
    }

    emptyBlock() {
        return this.list.length == 1 && this.list[0] instanceof ASTReturn && (this.list[0].value == null || this.list[0].value instanceof ASTNone);
    }

    codeFragment() {
        let result = new PycResult("", true);

        if (this.emptyBlock()) {
            result.add("pass");
        } else {
            let prevNode = null;

            for (let node of this.list) {
                if (prevNode) {
                    prevNode.nextSibling = node;
                }
                node.prevSibling = prevNode;
                prevNode = node;
            }
            prevNode = null;

            for (let node of this.list) {
                if (node.skip) {
                    continue;
                }
                let sourceFragment = node.codeFragment();
                if (!sourceFragment) {
                    prevNode = node;
                    continue;
                }
                let spacing = ASTNode.calculateSpacing(prevNode, node);
    
                if (prevNode && spacing == 0 && sourceFragment.length == 1) {
                    result.lastLineAppend((prevNode ? "; " : "") + sourceFragment.toString(), false);
                } else {
                    if (spacing > 1) {
                        result.add("");
                    }
                    result.add(sourceFragment)
                }
    
                prevNode = node;
            }
        }
        return result;
    }

    toString() {
        return `ASTNodeList: lines=[${this.line} - ${this.lastLine}], {\n${this.codeFragment().toString()}\n}`;
    }
}

class ASTChainStore extends ASTNodeList {
    m_src = null;

    constructor(nodes, src) {
        super(nodes);
        this.m_src = src;
    }

    get source() {
        return this.m_src;
    }

    set line(value) {
        this.m_lineNo = value;
    }
    
    get line() {
        let list = [this.m_lineNo, this.source.line].concat(this.list.map(node => node.line).filter(el => el > -1));
        return Math.min.apply(null, list);
    }

    get lastLine() {
        let list = [this.m_lineNo, this.source.line].concat(this.list.map(node => node.line).filter(el => el > -1));
        return Math.max.apply(null, list);
    }

    append(element) {
        this.list.push(element);
    }

    codeFragment() {
        let result = new PycResult("", true);

        if (this.list.length == 0) {
            return "###FIXME###";
        }
        let chain = this.list.map(node => node.codeFragment()).join(' = ');
        result.add(chain);
        result.lastLineAppend(" = ", false);
        result.lastLineAppend(this.source.codeFragment());
        
        return result;
    }

    toString() {
        return `ASTChainStore: lines=[${this.line} - ${this.lastLine}], ${this.codeFragment().toString()}`;
    }
}

class ASTObject extends ASTNode {
    m_obj = null;

    constructor(op) {
        super();
        this.m_obj = op;
    }
    get object() {
        return this.m_obj;
    }

    set object(value) {
        this.m_obj = value;
    }

    codeFragment() {
        if (!this.object) {
            return 'None';
        }
        let quote = ["Py_String", "Py_Unicode"].includes(this.object.ClassName) ? "'" : '';
        let result = this.object.toString();
        if (quote == "'" && result.indexOf("'") > -1) {
            quote = '"';
        }
        return quote + result + quote;
    }

    toString() {
        return `ASTObject: lines=[${this.line} - ${this.lastLine}], ${this.codeFragment()}`;
    }
}

class ASTUnary extends ASTNode {
    static UnaryOp = {
        Positive: 0,
        Negative: 1,
        Invert: 2,
        Not: 3
    };
    static UnaryOpString = ["+", "-", "~", "not "];

    m_op = null;
    m_operand = null;

    constructor(operand, op) {
        super();
        this.m_op = op;
        this.m_operand = operand;
    }

    get op() {
        return this.m_op;
    }

    get operand() {
        return this.m_operand;
    }

    codeFragment() {
        let result = `${ASTUnary.UnaryOpString[this.op]}${this.operand.codeFragment()}`;

        return result;
    }

    toString() {
        return `ASTUnary: line=${this.line}, ${this.codeFragment()}`;
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

    constructor(left, right, op) {
        super();
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

    set line(value) {
        this.m_lineNo = value;
    }

    get line() {
        return this.m_left.line;
    }

    get lastLine() {
        return this.m_right.line;
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

    codeFragment() {
        let result = new PycResult(`${this.left?.codeFragment() || "##ERROR##"}${this.op_str()}`, true);
        let rightSideResult = this.right?.codeFragment() || "##ERROR##";
        result.lastLineAppend(rightSideResult);

        return result;
    }

    toString() {
        return `ASTBinary: line=${this.line}, ${this.codeFragment()}`;
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

    constructor(left, right, op) {
        super(left, right, op);
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

    codeFragment() {
        let leftStr = this.left?.codeFragment() || "##ERROR##";
        let rightStr = this.right?.codeFragment() || "##ERROR##";
        let result = `${leftStr}${this.op_str()}${rightStr}`;

        return result;
    }

    toString() {
        return `ASTCompare: line=${this.line}, ${this.codeFragment()}`;
    }}

class ASTSlice extends ASTBinary {
    static SliceOp = {
        Slice0: 0,
        Slice1: 1,
        Slice2: 2,
        Slice3: 3
    };

    constructor(op, left, right) {
        left ||= new ASTNone('');
        right ||= new ASTNone('');
        super(left, right, op);
    }

    get isInplace() {
        return false;
    }

    codeFragment() {
        let str = '';

        switch (this.op) {
            case ASTSlice.SliceOp.Slice0:
                str = '[:]';
                break;
            case ASTSlice.SliceOp.Slice1:
                str = `[${this.left.codeFragment()}:]`;
                break;
            case ASTSlice.SliceOp.Slice2:
                str = `[:${this.right.codeFragment()}]`;
                break;
            case ASTSlice.SliceOp.Slice3:
                let startRange = this.left instanceof ASTNone ? '' : this.left.codeFragment();
                let endRange = this.right instanceof ASTNone ? '' : this.right.codeFragment();
                str = `[${startRange}:${endRange}]`;
                break;
            default:
                console.error(`Slice op ${this.op} is not defined.`);
                break;
        }
        return str;
    }

    toString() {
        return `ASTSlice: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTStore extends ASTNode {

    m_src = null;
    m_dest = null;

    constructor(src, dest) {
        super();
        this.m_src = src;
        this.m_dest = dest;
    }

    get src() {
        return this.m_src;
    }

    get dest() {
        return this.m_dest;
    }
    codeFragment() {
        let result = new PycResult("", true);
        let argNames = [];

        if (this.src instanceof ASTFunction) {
            let codeObject = this.src.code.object;
            let inLambda = codeObject.Name == "<lambda>";

            if (inLambda) {
                result.add(`${this.dest.codeFragment()} = lambda`);
            } else {
                if (!this.src.decorators.empty()) {
                    for (let decorator of this.src.decorators) {
                        result.add('@' + decorator.codeFragment());
                    }
                }
                result.add(codeObject.Flags & ASTFunction.CodeFlags.CO_COROUTINE ? "async ": "");
                result.lastLineAppend(`def ${this.dest.codeFragment()}(`);
            }

            let argIndex = 0;
            if (codeObject.ArgCount) {
                let default_params = this.src.defargs;
                let posOnlyCount = codeObject.PosOnlyArgCount || 0;

                // Unpack tuple defaults if needed (Python loads defaults as single tuple constant)
                if (default_params.length === 1 && default_params[0] instanceof ASTTuple) {
                    default_params = default_params[0].values;
                }

                // Process all regular args (positional-only + regular)
                for (argIndex = 0; argIndex < codeObject.ArgCount; argIndex++) {
                    let argName = codeObject.VarNames.Value[argIndex].toString();

                    // Add default value if present
                    if ((argIndex + 1) > (codeObject.ArgCount - default_params.length)) {
                        argName += "=" + default_params[argIndex - (codeObject.ArgCount - default_params.length)]?.codeFragment() || '##ERROR##';
                    }
                    argNames.push(argName);

                    // Add / separator after positional-only args
                    if (posOnlyCount > 0 && argIndex === posOnlyCount - 1) {
                        argNames.push("/");
                    }
                }

                if (codeObject.KWOnlyArgCount) {
                    argNames.push("*");
                    default_params = this.src.kwdefargs;
                    for (let kwIdx = 0; kwIdx < codeObject.KWOnlyArgCount; kwIdx++) {
                        let argName = codeObject.VarNames.Value[argIndex++].toString();

                        // Check if this kwonly arg has a default value
                        if (default_params && default_params.length > 0) {
                            let defaultIdx = kwIdx - (codeObject.KWOnlyArgCount - default_params.length);
                            if (defaultIdx >= 0 && default_params[defaultIdx]) {
                                argName += "=" + default_params[defaultIdx].value.codeFragment();
                            }
                        }
                        argNames.push(argName);
                    }
                }
            }
            if (codeObject.Flags & ASTFunction.CodeFlags.CO_VARARGS) {
                argNames.push('*' + codeObject.VarNames.Value[argIndex++].toString());
            }
            if (codeObject.Flags & ASTFunction.CodeFlags.CO_VARKEYWORDS) {
                argNames.push('**' + codeObject.VarNames.Value[argIndex++].toString());
            }
    
            result.lastLineAppend((argNames.length > 0 ? " " : "") + argNames.join(", "));
            
            if (inLambda) {
                result.lastLineAppend(": ", false);
            } else {
                result.lastLineAppend("):");
            }

            result.increaseIndent();
            if (codeObject.Globals.size) {
                for (let globalVar of codeObject.Globals) {
                    result.add(`global ` + globalVar);
                }
            }
            
            let methodBody = codeObject.SourceCode.codeFragment();
            if (inLambda) {
                result.lastLineAppend(methodBody);
            } else {
                result.add(methodBody);
            }
            result.decreaseIndent();

        } else if (this.src instanceof ASTClass) {
            let classNode = this.src;
            result.add(`class ${this.dest.codeFragment()}`);
            if (classNode.bases.values.length > 0) {
                result.lastLineAppend(`(${classNode.bases.values.map(node => node?.codeFragment() || "#ERROR##").join(", ")})`, false);
            }
            result.lastLineAppend(":");
            let codeObject = classNode.code.func.code.object;
            if (codeObject.SourceCode.last instanceof ASTReturn ) {
                codeObject.SourceCode.list.pop();
            }
            result.increaseIndent();
            // Add 'pass' for empty class bodies (after removing return)
            let classBody = codeObject.SourceCode.codeFragment();
            if (!classBody || classBody.toString().trim().length === 0) {
                result.add("pass");
            } else {
                result.add(classBody);
            }
            result.decreaseIndent();
        } else if (this.src instanceof ASTImport) {
            result.lastLineAppend(this.src.codeFragment());
        } else if (this.dest instanceof ASTName && this.dest.name == "__doc__" && this.src.object) {
            let docRows = this.src.object.toString().split("\\n");
            result.add('"""');
            result.lastLineAppend(docRows.shift());
            docRows.map(result.add.bind(result));
            result.lastLineAppend('"""');
        } else {
            if (this.dest instanceof ASTName && this.dest.name == "__module__" &&
                this.src instanceof ASTName && this.src.name == "__name__"){
                    return "";
            }
            if (this.dest instanceof ASTTuple) {
                this.dest.requireParens = false;
            }
            // Check if this is augmented assignment (+=, -=, etc.)
            if (this.src?.op >= ASTBinary.BinOp.InplaceAdd && this.src.op != ASTBinary.BinOp.InvalidOp) {
                // Compare dest and src.left by codeFragment to handle both simple names and attributes
                // IMPORTANT: codeFragment() returns PycResult object, need to convert to string
                let destCode = (this.dest?.codeFragment() || '').toString();
                let leftCode = (this.src.left?.codeFragment() || '').toString();

                if (destCode === leftCode) {
                    // Augmented assign: render as "a.value += 1" (src already contains the full expression)
                    // Don't add "a.value = " prefix - src.codeFragment() already includes "a.value += 1"
                    result.lastLineAppend(this.src?.codeFragment() || '##ERROR##');
                } else {
                    // Regular assign where dest != src.left
                    result.lastLineAppend(this.dest?.codeFragment() || '##ERROR##');
                    result.lastLineAppend(" = ", false);
                    result.lastLineAppend(this.src?.codeFragment() || '##ERROR##');
                }
            } else {
                // Regular assignment
                result.lastLineAppend(this.dest?.codeFragment() || '##ERROR##');
                result.lastLineAppend(" = ", false);
                result.lastLineAppend(this.src?.codeFragment() || '##ERROR##');
            }
        }

        return result;
    }

    toString() {
        return `ASTStore: line=${this.line}, ${this.codeFragment().toString()}`;
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

    constructor(value, rettype = ASTReturn.RetType.Return) {
        super();
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

    codeFragment() {
        let result = new PycResult("", true);

        if (!this.inLambda) {
            switch (this.rettype) {
                case ASTReturn.RetType.Return:
                    if (!this.value || this.value instanceof ASTNone) {
                        result.add("return");
                    } else {
                        result.add("return ");
                        result.lastLineAppend(this.value.codeFragment());
                    }
                    break;
                case ASTReturn.RetType.Yield:
                    result.add("yield ");
                    result.lastLineAppend(this.value.codeFragment());
                    break;
                case ASTReturn.RetType.YieldFrom:
                    if (this.value instanceof ASTAwaitable) {
                        result.add("await ");
                        result.lastLineAppend(this.value.expression?.codeFragment() || "###FIXME###");
                    } else {
                        result.add("yield from ");
                        result.lastLineAppend(this.value.codeFragment());
                    }
                    break;
            }

            return result;
        }

        return this.value?.codeFragment() || "";
    }

    toString() {
        return `${this.constructor.name}: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTNamedExpr extends ASTNode {
    m_target = null;
    m_value = null;

    constructor(target, value) {
        super();
        this.m_target = target;
        this.m_value = value;
    }

    get target() {
        return this.m_target;
    }

    get value() {
        return this.m_value;
    }

    codeFragment() {
        let targetStr = this.target?.codeFragment() || "##ERROR##";
        let valueStr = this.value?.codeFragment() || "##ERROR##";
        return `(${targetStr} := ${valueStr})`;
    }

    toString() {
        return `${this.constructor.name}: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTName extends ASTNode {
    m_name = null;

    constructor(name) {
        super();
        this.m_name = name;
    }

    set name(value) {
        this.m_name = value;
    }

    get name() {
        return this.m_name;
    }


    codeFragment() {
        return this.name?.toString() || "##ERROR##";
    }

    toString() {
        return `${this.constructor.name}: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTDelete extends ASTNode {
    m_value = null;

    constructor(value, rettype) {
        super();
        this.m_value = value;
    }

    get value() {
        return this.m_value;
    }

    codeFragment() {
        let result = `del ${this.value?.codeFragment().toString().trim() || '##ERROR##'}`;

        return result;
    }

    toString() {
        return `${this.constructor.name}: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTFunction extends ASTNode {

    static CodeFlags = {
        CO_OPTIMIZED: 0x1,
        CO_NEWLOCALS: 0x2,
        CO_VARARGS: 0x4,
        CO_VARKEYWORDS: 0x8,
        CO_NESTED: 0x10,
        CO_GENERATOR: 0x20,
        CO_NOFREE: 0x40,
        CO_COROUTINE: 0x80,
        CO_ITERABLE_COROUTINE: 0x100,
        CO_GENERATOR_ALLOWED: 0x1000,
        CO_FUTURE_DIVISION: 0x2000,
        CO_FUTURE_ABSOLUTE_IMPORT: 0x4000,
        CO_FUTURE_WITH_STATEMENT: 0x8000,
        CO_FUTURE_PRINT_FUNCTION: 0x10000,
        CO_FUTURE_UNICODE_LITERALS: 0x20000,
        CO_FUTURE_BARRY_AS_BDFL: 0x40000,
        CO_FUTURE_GENERATOR_STOP: 0x80000,
    };


    m_code = null;
    m_defargs = null;
    m_kwdefargs = null;
    m_decorators = [];

    constructor(code, defargs = [], kwdefargs = [], annotations = []) {
        super();
        this.m_code = code;
        this.m_defargs = defargs;
        this.m_kwdefargs = kwdefargs;
        this.m_decorators = annotations;
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

    add_decorator(name) {
        this.m_decorators.unshift(name);
    }

    get decorators() {
        return this.m_decorators;
    }

    codeFragment() {
        let result = "(lambda";
        let codeObject = this.code.object;

        let argIndex = 0;
        let argNames = [];
        if (codeObject.ArgCount) {
            let default_params = this.defargs;
            for (let idx = 0; idx < codeObject.ArgCount; idx++) {
                let argName = codeObject.VarNames.Value[argIndex].toString();
                
                if ((argIndex + 1) > (codeObject.ArgCount - default_params.length)) {
                    argName += "=" + default_params[argIndex - (codeObject.ArgCount - default_params.length)].codeFragment();
                }
                argIndex++;
                argNames.push(argName);
            }

            if (codeObject.KWOnlyArgCount) {
                default_params = this.kwdefargs;
                let firstFlag = true;
                for (let idx = 0; idx < codeObject.KWOnlyArgCount; idx++) {
                    let argName = codeObject.VarNames.Value[argIndex].toString();

                    if (firstFlag) {
                        argName = "*" + argName;
                        firstFlag = false;
                    }
                    
                    if ((argIndex + 1) > (codeObject.ArgCount - default_params.length)) {
                        argName += "=" + default_params[argIndex - (codeObject.ArgCount - default_params.length)].codeFragment();
                    }
                    argIndex++;
                    argNames.push(argName);
                }
                if (codeObject.Flags & ASTFunction.CodeFlags.CO_VARARGS) {
                    argNames.push("*" + codeObject.VarNames.Value[argIndex++].toString());
                }
                if (codeObject.Flags & ASTFunction.CodeFlags.CO_VARKEYWORDS) {
                    argNames.push("**" + codeObject.VarNames.Value[argIndex++].toString());
                }
            }
        }
        result += (argNames.length > 0 ? " " : "") + argNames.join(", ") + ": ";
        codeObject.SourceCode.last.inLambda = true;
        result += codeObject.SourceCode.list.map(node => node.codeFragment()).filter(node => node.length > 0).join("; ") + ")";
        return result;
    }

    toString() {
        return `${this.constructor.name}: lines=[${this.line} - ${this.lastLine}], ${this.codeFragment()}`;
    }
}

class ASTClass extends ASTNode {
    m_code = null;
    m_bases = null;
    m_name = null;

    constructor(code, bases, name) {
        super();
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

    codeFragment() {
        let result = `#TODO ${this.constructor.name} ${this.code.codeFragment()}`;

        return result;
    }

    toString() {
        return `${this.constructor.name}: lines=[${this.line} - ${this.lastLine}], ${this.codeFragment()}`;
    }
}

class ASTCall extends ASTNode {
    m_func = null;
    m_pparams = null;
    m_kwparams = null;
    m_var = null;
    m_kw = null;

    constructor(func, pparams, kwparams) {
        super();
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

    get kw() {
        return this.m_kw;
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


    codeFragment() {
        let result = new PycResult("", true);

        result.lastLineAppend((this.func?.codeFragment() || "##ERROR##") + '(');
        let params = [];
        if (this.pparams?.length > 0) {
            params.push(this.pparams.map(node => node?.codeFragment() || "##ERROR##").join(', ').trim());
        }
        if (this.kwparams?.length > 0) {
            params.push(this.kwparams.map(node => `${node?.key?.codeFragment().toString().replaceAll("'",'')} = ${node?.value?.codeFragment() || "##ERROR##"}`).join(', ').trim());
        }
        if (this.hasVar) {
            params.push('*' +this.var.codeFragment());
        }
        if (this.hasKw) {
            params.push('**' +this.kw.codeFragment());
        }
        result.lastLineAppend(params.join(', ') + ')');
        return result;
    }

    toString() {
        return `${this.constructor.name}: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTImport extends ASTNode {
    m_name = null;
    m_alias = null;
    m_stores = [];
    m_fromlist = null;

    constructor(name, fromlist, alias = null) {
        super();
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

    codeFragment() {
        let result;

        if (!this.stores.empty()) {
            result = `from ${this.name instanceof ASTImport ? this.name.name.codeFragment() : this.name.codeFragment()} import `;
            result += this.stores.map(el => `${el.src.codeFragment()}${el.dest && el.src.codeFragment() != el.dest.codeFragment() ? ' as ' + el.dest.codeFragment() : ''}`).join(', ');
        } else {
            let nextNode = this;
            let importNodes = [];
            while (nextNode) {
                if (nextNode instanceof ASTImport && nextNode.stores.empty() && this.line == nextNode.line ) {
                    let res = nextNode.name.codeFragment();
                    if (nextNode.alias && nextNode.name.codeFragment() != nextNode.alias?.codeFragment()) {
                        res += ` as ${nextNode.alias?.codeFragment()}`;
                    }
                    importNodes.push(res);
                    nextNode.skip = true;
                } else {
                    break;
                }
                nextNode = nextNode.nextSibling;
            }

            result = "import " + importNodes.join(", ");
        }
        return result;
    }

    toString() {
        return `ASTImport: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTTuple extends ASTNode {
    m_values = [];
    m_requireParens = true;

    constructor(values) {
        super();
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

    codeFragment() {
        let openParen = '', closeParen = '';

        if (this.requireParens) {
            openParen = '(';
            closeParen = ')';
        }

        // TODO: add new lines if tuple values are on different liens
        let result = ASTNode.renderList(this.values, openParen, closeParen);

        return result;
    }

    toString() {
        return `ASTTuple: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTList extends ASTNode {
    m_values = [];

    constructor(values) {
        super();
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

    codeFragment() {
        let result = ASTNode.renderList(this.values, '[', ']');
        return result;
    }

    toString() {
        return `ASTList: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTSet extends ASTNode {
    m_values = [];

    constructor(values) {
        super();
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

    codeFragment() {
        let result = ASTNode.renderList(this.values, '{', '}');
        return result;
    }

    toString() {
        return `ASTSet: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTMap extends ASTNode {
    m_values = [];

    constructor(values) {
        super();
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

    codeFragment() {
        let result = ASTNode.renderList(this.values, '{', '}', el => el.key.codeFragment() + ': ' + el.value.codeFragment());
        return result;
    }

    toString() {
        return `ASTMap: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTKwNamesMap extends ASTNode {
    m_values = [];

    constructor(values) {
        super();
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

    codeFragment() {
        let result = '{' + this.values.map(el => el.key.codeFragment() + ': ' + el.value.codeFragment()).join(', ') + '}';

        return result;
    }

    toString() {
        return `ASTKwNamesMap: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTConstMap extends ASTNode {
    m_keys = {};
    m_values = {};

    constructor(keys, values) {
        super();
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

    codeFragment() {
        // Extract keys from ASTObject tuple
        let keysArray = [];
        if (this.keys instanceof ASTObject &&
            (this.keys.object?.ClassName === 'Py_Tuple' || this.keys.object?.ClassName === 'Py_SmallTuple')) {
            keysArray = this.keys.object.Value.map(v => new ASTObject(v));
        } else if (Array.isArray(this.keys)) {
            keysArray = this.keys;
        }

        // values is already an array (from dataStack.pop loop)
        // Reverse because values are popped from stack in reverse order
        let valuesArray = Array.isArray(this.values) ? [...this.values].reverse() : [];

        if (keysArray.length === 0) {
            return '{}';
        }

        let pairs = [];
        for (let i = 0; i < keysArray.length; i++) {
            let keyStr = keysArray[i]?.codeFragment() || '##ERROR##';
            let valueStr = valuesArray[i]?.codeFragment() || '##ERROR##';
            pairs.push(`${keyStr}: ${valueStr}`);
        }

        return '{' + pairs.join(', ') + '}';
    }

    toString() {
        return `ASTConstMap: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTSubscr extends ASTNode {
    m_name = null;
    m_key = null;

    constructor(name, key) {
        super();
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

    codeFragment() {
        let result = new PycResult(this.name?.codeFragment() || '##ERROR##', true);
        let skipBrackets = this.key instanceof ASTSlice;

        if (!skipBrackets) {
            result.lastLineAppend('[');
        }
        result.lastLineAppend(this.key?.codeFragment() || "##ERROR##");
        if (!skipBrackets) {
            result.lastLineAppend(']');
        }

        return result;
    }

    toString() {
        return `ASTSubscr: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTPrint extends ASTNode {
    m_values = [];
    m_stream = null;
    m_eol = false;

    constructor(value, stream) {
        super();
        
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

    get stream() {
        return this.m_stream;
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

    add (value) {
        this.values.push(value);
    }

    codeFragment() {
        let result = `print`;

        if (this.stream) {
            result += ` >> ${this.stream.codeFragment()}`;
        }

        result += ' ' + this.values.map(node => node.codeFragment()).join(', ') + (this.eol ? '' : ',');

        return result;
    }

    toString() {
        return `ASTPrint: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTConvert extends ASTNode {
    m_name = null;

    constructor(name) {
        super();
        this.m_name = name;
    }

    get name() {
        return this.m_name;
    }

    codeFragment() {
        let result = "`" + this.name.codeFragment() +"`";

        return result;
    }

    toString() {
        return `ASTPrint: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTKeyword extends ASTNode {
    static Word = {
        Pass: 0,
        Break: 1,
        Continue: 2
    }
    
    m_key = null;

    constructor(key) {
        super();
        this.m_key = key;
    }

    get key() {
        return this.m_key;
    }

    get word() {
        return ["pass", "break", "continue"][this.key];
    }

    codeFragment() {
        return new PycResult(this.word, true);
    }

    toString() {
        return `ASTKeyword: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTRaise extends ASTNode {
    m_params = [];

    constructor(params) {
        super();
        this.m_params = params;
    }

    get params() {
        return this.m_params;
    }

    get lastLine() {
        return this.params[this.params.length - 1]?.lastLine;
    }

    codeFragment() {
        let result = 'raise ' + this.params.map(node => node.codeFragment()).join(', ');

        return result;
    }

    toString() {
        return `ASTRaise: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTExec extends ASTNode {
    m_stmt = null;
    m_glob = null;
    m_loc = null;

    constructor(stmt, glob, loc) {
        super();
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

    codeFragment() {
        let result = `exec ${this.statement.codeFragment()}`;

        if (this.globals) {
            result += ` in ${this.globals.codeFragment()}`;
            if (this.locals && this.globals.codeFragment != this.locals.codeFragment) {
                result += `, ${this.locals.codeFragment()}`;
            }
        }


        return result;
    }

    toString() {
        return `ASTRaise: line=${this.line}, ${this.codeFragment()}`;
    }
}

class ASTIteratorValue extends ASTNode {
    m_value = null;

    constructor(value) {
        super();
        this.m_value = value;
    }

    get value() {
        return this.m_value;
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

    constructor(blockType, start = 0, end = 0, inited = 0) {
        super();
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

    get line() {
        return this.m_lineNo > -1 ? this.m_lineNo : (this.nodes[0]?.lastLine || -1);
    }
    set line(lineNo) {
        this.m_lineNo = lineNo;
    }


    get lastLine() {
        return this.nodes[this.nodes.length - 1]?.lastLine || -1;
    }

    get type_str() {
        return [
            "", "if", "else", "elif", "try", "CONTAINER", "except",
            "finally", "while", "for", "with", "async for"
        ][this.blockType];
    }

    init(value = 1) {
        if (global.g_cliArgs?.debug && this.blockType == ASTBlock.BlockType.AsyncFor) {
            console.log(`[ASTBlock.init] AsyncFor.init() called, setting inited=${value}`);
            console.trace();
        }
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

    /**
     * Check if this block contains any nested blocks (if/elif/else/while/for/etc.)
     * Used for elif detection to avoid converting nested if to elif
     */
    hasNestedBlocks() {
        return this.nodes.some(node => node instanceof ASTBlock);
    }

    codeFragment() {
        let result = new PycResult("", true);

        if (this.blockType == ASTBlock.BlockType.Else && this.nodes.empty()) {
            return "";
        }
        
        result.add(this.type_str + ":");

        result.increaseIndent();
        if (!this.nodes.empty()) {
            // TODO: Refactor this code to use ASTNodeList that already natively handles that
            if (this.nodes.length > 1 && !this.nodes[0].nextSibling) {
                let prevNode = null;

                for (let node of this.nodes) {
                    if (prevNode) {
                        prevNode.nextSibling = node;
                    }
                    node.prevSibling = prevNode;
                    prevNode = node;
                }
            }
            this.nodes.map(node => !node.skip && result.add(node.codeFragment()));
        } else {
            result.add("pass");
        }
        result.decreaseIndent();

        return result;
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

    constructor(blockType, start = 0, end = 0, cond, negative) {
        super(blockType, start, end);
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
    
    codeFragment() {
        let result = new PycResult("", true);

        // This is the assert case
        if (this.blockType == ASTBlock.BlockType.If && this.negative && this.condition && this.nodes.length == 1 && this.nodes[0] instanceof ASTRaise) {
            result.lastLineAppend("assert ", false);
            result.lastLineAppend(this.condition.codeFragment());
            if (this.nodes.length == 1 && this.nodes[0] instanceof ASTRaise && this.nodes[0].params.length == 1 && this.nodes[0].params[0] instanceof ASTCall) {
                result.lastLineAppend(', ' + this.nodes[0].params[0].pparams.map(node => node.codeFragment()).join(", "));
            }
            return result;
        }

        if (
            this.prevSibling instanceof ASTStore &&
            this.blockType == ASTBlock.BlockType.If &&
            this.nodes.length == 1 &&
            this.nextSibling instanceof ASTCondBlock &&
            this.nextSibling?.type == ASTBlock.BlockType.Else &&
            this.nextSibling?.nodes.length == 1 &&
            this.condition.line >= 0 &&
            this.condition.line == this.nodes[0].line &&
            this.condition.line == this.nextSibling?.nodes[0].line
        ) {
            result.add(this.nodes[0].codeFragment() || "###ERROR###");
            result.lastLineAppend(" if", false);
            result.lastLineAppend(this.negative ? " not" : "", false);
            result.lastLineAppend(" ", false);
            result.lastLineAppend(this.condition?.codeFragment() || "True");
            result.lastLineAppend(" else ", false);
            result.lastLineAppend(this.nextSibling.nodes[0].codeFragment() || "###ERROR###");
            this.nextSibling.skip = true;
        } else if (
            this.prevSibling == null &&
            this.blockType == ASTBlock.BlockType.If &&
            this.nodes.length == 1 &&
            this.nextSibling instanceof ASTReturn &&
            this.condition.line == this.nodes[0].line &&
            this.condition.line == this.nextSibling?.value.line
        ) {
            result.add(this.nodes[0].codeFragment() || "###ERROR###");
            result.lastLineAppend(" if", false);
            result.lastLineAppend(this.negative ? " not" : "", false);
            result.lastLineAppend(" ", false);
            result.lastLineAppend(this.condition?.codeFragment() || "True");
            result.lastLineAppend(" else ", false);
            result.lastLineAppend(this.nextSibling.value.codeFragment() || "###ERROR###");
            this.nextSibling.skip = true;
        } else {
            result.add(this.type_str);
            if ([ASTBlock.BlockType.If, ASTBlock.BlockType.Elif, ASTBlock.BlockType.While].includes(this.blockType)) {
                result.lastLineAppend(this.negative ? " not" : "", false);
                result.lastLineAppend(" ", false);

                // For while loops without explicit condition (null), use "1" instead of "True" (Python convention: while 1:)
                let conditionStr = this.condition?.codeFragment();
                if (!conditionStr) {
                    conditionStr = this.blockType == ASTBlock.BlockType.While ? "1" : "True";
                }
                result.lastLineAppend(conditionStr);
            } else if ([ASTBlock.BlockType.Except].includes(this.blockType) && this.condition) {
                if (this.condition instanceof ASTStore) {
                    result.lastLineAppend(" ", false);
                    if (this.condition.src) {
                        result.lastLineAppend(this.condition.src.codeFragment());
                    }
                    result.lastLineAppend(" as ", false);
                    if (this.condition.dest) {
                        result.lastLineAppend(this.condition.dest.codeFragment());
                    }
                } else if (this.condition) {
                    result.lastLineAppend(" ", false);
                    result.lastLineAppend(this.condition.codeFragment());
                }
            }

            result.lastLineAppend(":");
            result.increaseIndent();

            // Filter nodes for rendering (exclude synthetic __exception__ in except blocks)
            let nodesToRender = this.nodes.filter(el=>el).filter(node => {
                // Filter out synthetic __exception__ variables from except blocks
                if (this.blockType == ASTBlock.BlockType.Except &&
                    node instanceof ASTName &&
                    node.name == '__exception__') {
                    return false;
                }
                return node && !node.skip && node.codeFragment;
            });

            if (nodesToRender.length === 0) {
                result.add("pass");
            } else {
                // TODO: Refactor this code to use ASTNodeList that already natively handles that
                if (this.nodes.length > 1 && !this.nodes[0].nextSibling) {
                    let prevNode = null;

                    for (let node of this.nodes) {
                        if (!node) {
                            continue;
                        }
                        if (prevNode) {
                            prevNode.nextSibling = node;
                        }
                        node.prevSibling = prevNode;
                        prevNode = node;
                    }
                }
                nodesToRender.forEach(node => {
                    result.add(node.codeFragment());
                });
            }
            result.decreaseIndent();
        }        
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

    constructor(blockType, start = 0, end = 0, iter) {
        super(blockType, start, end);
        this.m_iter = iter;
    }
    
    get start() {
        return this.m_start;
    }

    get iter() {
        return this.m_iter;
    }

    set iter(value) {
        this.m_iter = value;
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
    
    codeFragment() {
        let result = new PycResult("", true);

        // Add "async" prefix for async for loops
        if (this.blockType == ASTBlock.BlockType.AsyncFor) {
            result.lastLineAppend("async for ", false);
        } else {
            result.lastLineAppend("for ", false);
        }

        result.lastLineAppend(this.index?.codeFragment() || "##ERROR##");
        result.lastLineAppend(" in ", false);
        result.lastLineAppend(this.iter?.codeFragment() || "##ERROR##");
        result.lastLineAppend(":");
        result.increaseIndent();
        this.nodes.map(node => node && result.add(node.codeFragment()));
        result.decreaseIndent();

        return result;
    }

    toString() {
        return `${this.type_str} block: {${this.start} - ${this.end}}`;
    }
}

class ASTContainerBlock extends ASTBlock {

    m_finally = 0;
    m_except = 0;

    constructor(start = 0, _finally, except = 0) {
        super(ASTBlock.BlockType.Container, start);
        this.m_finally = _finally;
        this.m_except = except;
    }

    get finally() {
        return this.m_finally;
    }

    set finally(value) {
        this.m_finally = value;
    }

    get hasFinally() {
        return !!this.m_finally;
    }
    
    get except() {
        return this.m_except;
    }

    set except(value) {
        this.m_except = value;
    }

    get hasExcept() {
        return !!this.m_except;
    }
    
    codeFragment() {
        let result = new PycResult("", true);

        this.nodes.filter(el => el instanceof ASTNode).map(node => result.add(node.codeFragment()));

        return result;
    }

    toString() {
        return `${this.type_str} block: {${this.start} - ${this.end}}`;
    }
}

class ASTWithBlock extends ASTBlock {

    m_expr = null;
    m_var = null;

    constructor(start = 0, end = 0) {
        super(ASTBlock.BlockType.With, start, end);
    }
    
    get expr() {
        return this.m_expr;
    }

    set expr(value) {
        this.m_expr = value;
    }
    
    get var() {
        return this.m_var;
    }

    set var(value) {
        this.m_var = value;
    }
    
    codeFragment() {
        let result = new PycResult();
        result.doNotIndent = true;

        result.lastLineAppend("with ", false);
        result.lastLineAppend(this.expr.codeFragment());
        
        if (this.var) {
            result.lastLineAppend(" as ", false);
            result.lastLineAppend(this.var.codeFragment());
        }
        
        result.lastLineAppend(":");
        result.increaseIndent();
        this.nodes.map(node => result.add(node.codeFragment()));
        result.decreaseIndent();
        
        return result;
    }

    toString() {
        return `${this.type_str} block: {${this.start} - ${this.end}}`;
    }
}

class ASTComprehension extends ASTNode {

    static LIST = 0;
    static SET = 1;
    static DICT = 2;

    m_kind = ASTComprehension.LIST;
    m_key = null;
    m_result = null;
    m_generators = [];

    constructor(result, key = null) {
        super();
        this.m_key = key;
        this.m_result = result;
    }

    set kind (value) {
        this.m_kind = value;
    }

    get kind () {
        return this.m_kind;
    }

    set key (value) {
        this.m_key = value;
    }

    get key () {
        return this.m_key;
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
    
    codeFragment() {
        let openingBracket = '[';
        let closingBracket = ']';

        if ([ASTComprehension.SET, ASTComprehension.DICT].includes(this.kind)) {
            openingBracket = '{';
            closingBracket = '}';
        }

        let result = `${openingBracket}${this.kind == ASTComprehension.DICT ? (this.key?.codeFragment() || "##ERROR##") + ": " : ""}${this.result.codeFragment()}`;

        result += this.generators.map(gen => {
            let genString = ` for ${gen.index.codeFragment()} in ${gen.iter.codeFragment()}`;

            if (gen.condition) {
                genString += ` if ${gen.condition.codeFragment()}`;
            }

            return genString;
        }).join("") + closingBracket;

        return result;
    }

    toString() {
        return `ASTComprehension: {${this.start} - ${this.end}}, ${this.codeFragment()}`;
    }
}

class ASTLoadBuildClass extends ASTNode {

    m_obj = null;

    constructor(obj) {
        super();
        this.m_obj = obj;
    }
    
    get object() {
        return this.m_obj;
    }

    codeFragment() {
        return "";
    }

    toString() {
        return `ASTLoadBuildClass: [${this.line} - ${this.lastLine}], ${this.codeFragment()}`;
    }
}

class ASTAwaitable extends ASTNode {

    m_expr = null;

    constructor(expr) {
        super();
        this.m_expr = expr;
    }
    
    get expression() {
        return this.m_expr;
    }

    codeFragment() {
        let result = `#TODO ${this.constructor.name}`;

        return result;
    }

    toString() {
        return `ASTAwaitable: [${this.line} - ${this.lastLine}], ${this.codeFragment()}`;
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

    constructor(val, conversion, format_spec) {
        super();
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
    
    codeFragment() {
        // Format: {value} or {value!r} or {value:.2f}
        let result = "{";

        if (this.m_val) {
            result += this.m_val.codeFragment();
        }

        // Add conversion flag (!s, !r, !a)
        switch (this.m_conversion) {
            case ASTFormattedValue.ConversionFlag.Str:
                result += "!s";
                break;
            case ASTFormattedValue.ConversionFlag.Repr:
                result += "!r";
                break;
            case ASTFormattedValue.ConversionFlag.ASCII:
                result += "!a";
                break;
        }

        // Add format spec (:.2f, :x, etc.)
        if (this.m_format_spec) {
            result += ":";
            // Format spec can be ASTJoinedStr (nested f-string) or string constant
            if (this.m_format_spec instanceof ASTJoinedStr) {
                result += this.m_format_spec.codeFragment();
            } else if (this.m_format_spec instanceof ASTObject) {
                // String constant like ".2f"
                result += this.m_format_spec.object.Value;
            } else {
                result += this.m_format_spec.codeFragment();
            }
        }

        result += "}";
        return result;
    }

    toString() {
        return `${this.constructor.name}: Line ${this.line}, ${this.codeFragment()}`;
    }
}

class ASTJoinedStr extends ASTNode {
    m_values = null;

    constructor(values) {
        super();
        this.m_values = values;
    }
    
    get values() {
        return this.m_values;
    }

    get lastLine() {
        return this.values[this.values.length - 1]?.lastLine;
    }
    codeFragment() {
        // f-string format: f"literal {expr} literal"
        let result = 'f"';

        // Values are in reverse order (BUILD_STRING pops from stack)
        // So we need to reverse them
        let values = [...this.m_values].reverse();

        for (let i = 0; i < values.length; i++) {
            let value = values[i];

            if (value instanceof ASTFormattedValue) {
                // Check for f-string = debugging pattern (Python 3.8+)
                // Pattern: literal ending with "varname=" followed by {varname!r}
                if (i > 0 && values[i-1] instanceof ASTObject) {
                    let prevStr = values[i-1].object?.Value || '';
                    let match = prevStr.match(/([a-zA-Z_]\w*)\s*=$/);

                    if (match && value.m_val instanceof ASTName &&
                        value.m_val.name === match[1] &&
                        value.m_conversion === ASTFormattedValue.ConversionFlag.Repr &&
                        !value.m_format_spec) {
                        // This is f"{varname=}" syntax
                        // Remove the "varname=" suffix from previous literal
                        let prefix = prevStr.substring(0, prevStr.length - match[0].length);

                        // Remove the previously added literal and replace with prefix + {var=}
                        let beforeLiteral = result.lastIndexOf(prevStr.replace(/\\/g, '\\\\')
                            .replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t'));

                        if (beforeLiteral !== -1) {
                            result = result.substring(0, beforeLiteral);
                        }

                        // Add prefix (escaped) if present
                        if (prefix) {
                            let escapedPrefix = prefix.replace(/\\/g, '\\\\');
                            escapedPrefix = escapedPrefix.replace(/"/g, '\\"');
                            escapedPrefix = escapedPrefix.replace(/\n/g, '\\n');
                            escapedPrefix = escapedPrefix.replace(/\t/g, '\\t');
                            result += escapedPrefix;
                        }

                        // Add {varname=} instead of varname={varname!r}
                        result += `{${match[1]}=}`;
                        continue;
                    }
                }

                // {expression} part
                result += value.codeFragment();
            } else if (value instanceof ASTObject && value.object?.ClassName === 'Py_String') {
                // Literal string part - need to escape special chars
                let str = value.object.Value;
                // Escape backslashes and quotes
                str = str.replace(/\\/g, '\\\\');
                str = str.replace(/"/g, '\\"');
                str = str.replace(/\n/g, '\\n');
                str = str.replace(/\t/g, '\\t');
                result += str;
            } else {
                // Fallback for unexpected types
                result += value.codeFragment();
            }
        }

        result += '"';
        return result;
    }

    toString() {
        return `${this.constructor.name}: Line ${this.line}, ${this.codeFragment()}`;
    }
}

class ASTAnnotatedVar extends ASTNode {
    m_name = null;
    m_type = null;

    constructor(name, type) {
        super();
        this.m_name = name;
        this.m_type = type;
    }
    
    get name() {
        return this.m_name;
    }

    get annotation() {
        return this.m_type;
    }

    codeFragment() {
        let result = `#TODO ${this.constructor.name}`;

        return result;
    }

    toString() {
        return `${this.constructor.name}: Line ${this.line}, ${this.codeFragment()}`;
    }
}

class ASTTernary extends ASTNode {
    m_if_block = null;
    m_if_expr = null;
    m_else_expr = null;
    constructor(if_block, if_expr, else_expr) {
        super();
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

    codeFragment() {
        let result = `${this.if_expr?.codeFragment() || '##ERROR##'} if ${this.if_block?.negative ? "not " : ""} ${this.if_block.condition?.codeFragment() || '##ERROR##'} else ${this.else_expr?.codeFragment() || '##ERROR##'}`;
        return result;
    }

    toString() {
        return `${this.constructor.name}: Line ${this.line}, ${this.codeFragment()}`;
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
    ASTNamedExpr,
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
    ASTTernary,
    ASTIteratorValue
};

// Registering classes in global scope for propoer class deserialization.
for (let className of Object.keys(module.exports)) {
    global[className] = new module.exports[className]();
}
