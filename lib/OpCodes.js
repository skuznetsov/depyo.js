const OpCode = require('./OpCode');

class OpCodes
{
    static STOP_CODE = 0;

    static POP_TOP = 1;
    static ROT_TWO = 2;
    static ROT_THREE = 3;
    static DUP_TOP = 4;
    static ROT_FOUR = 5;
    static NOP = 9;
    
    static UNARY_POSITIVE = 10;
    static UNARY_NEGATIVE = 11;
    static UNARY_NOT = 12;
    static UNARY_CONVERT = 13;
    
    static UNARY_INVERT = 15;
    
    static BINARY_POWER = 19;
    
    static BINARY_MULTIPLY = 20;
    static BINARY_DIVIDE = 21;
    static BINARY_MODULO = 22;
    static BINARY_ADD = 23;
    static BINARY_SUBTRACT = 24;
    static BINARY_SUBSCR = 25;
    static BINARY_FLOOR_DIVIDE = 26;
    static BINARY_TRUE_DIVIDE = 27;
    static INPLACE_FLOOR_DIVIDE = 28;
    static INPLACE_TRUE_DIVIDE = 29;
    
    static SLICE = 30;
    static SLICE1 = 31;
    static SLICE2 = 32;
    static SLICE3 = 33;
    
    static STORE_SLICE = 40;
    static STORE_SLICE1 = 41;
    static STORE_SLICE2 = 42;
    static STORE_SLICE3 = 43;
    
    static DELETE_SLICE = 50;
    static DELETE_SLICE1 = 51;
    static DELETE_SLICE2 = 52;
    static DELETE_SLICE3 = 53;
    
    static STORE_MAP = 54;
    static INPLACE_ADD = 55;
    static INPLACE_SUBTRACT = 56;
    static INPLACE_MULTIPLY = 57;
    static INPLACE_DIVIDE = 58;
    static INPLACE_MODULO = 59;
    static STORE_SUBSCR = 60;
    static DELETE_SUBSCR = 61;
    
    static BINARY_LSHIFT = 62;
    static BINARY_RSHIFT = 63;
    static BINARY_AND = 64;
    static BINARY_XOR = 65;
    static BINARY_OR = 66;
    static INPLACE_POWER = 67;
    static GET_ITER = 68;
    
    static PRINT_EXPR = 70;
    static PRINT_ITEM = 71;
    static PRINT_NEWLINE = 72;
    static PRINT_ITEM_TO = 73;
    static PRINT_NEWLINE_TO = 74;
    static INPLACE_LSHIFT = 75;
    static INPLACE_RSHIFT = 76;
    static INPLACE_AND = 77;
    static INPLACE_XOR = 78;
    static INPLACE_OR = 79;
    static BREAK_LOOP = 80;
    static WITH_CLEANUP = 81;
    static LOAD_LOCALS = 82;
    static RETURN_VALUE = 83;
    static IMPORT_STAR = 84;
    static EXEC_STMT = 85;
    static YIELD_VALUE = 86;
    static POP_BLOCK = 87;
    static END_FINALLY = 88;
    static BUILD_CLASS = 89;
    
    static HAVE_ARGUMENT = 90;	/* Opcodes from here have an argument: */
    
    static STORE_NAME = 90;	/* Index in name list */
    static DELETE_NAME = 91;	/* "" */
    static UNPACK_SEQUENCE = 92;	/* Number of sequence items */
    static FOR_ITER = 93;
    static LIST_APPEND = 94;
    
    static STORE_ATTR = 95;	/* Index in name list */
    static DELETE_ATTR = 96;	/* "" */
    static STORE_GLOBAL = 97;	/* "" */
    static DELETE_GLOBAL = 98;	/* "" */
    static DUP_TOPX = 99;	/* number of items to duplicate */
    static LOAD_CONST = 100;	/* Index in const list */
    static LOAD_NAME = 101;	/* Index in name list */
    static BUILD_TUPLE = 102;	/* Number of tuple items */
    static BUILD_LIST = 103;	/* Number of list items */
    static BUILD_SET = 104;     /* Number of set items */
    static BUILD_MAP = 105;	/* Always zero for now */
    static LOAD_ATTR = 106;	/* Index in name list */
    static COMPARE_OP = 107;	/* Comparison operator */
    static IMPORT_NAME = 108;	/* Index in name list */
    static IMPORT_FROM = 109;	/* Index in name list */
    static JUMP_FORWARD = 110;	/* Number of bytes to skip */
    
    static JUMP_IF_FALSE_OR_POP = 111; /* Target byte offset from beginning of code */
    static JUMP_IF_TRUE_OR_POP = 112;	/* "" */
    static JUMP_ABSOLUTE = 113;	/* "" */
    static POP_JUMP_IF_FALSE = 114;	/* "" */
    static POP_JUMP_IF_TRUE = 115;	/* "" */
    
    static LOAD_GLOBAL = 116;	/* Index in name list */
    
    static CONTINUE_LOOP = 119;	/* Start of loop (absolute) */
    static SETUP_LOOP = 120;	/* Target address (relative) */
    static SETUP_EXCEPT = 121;	/* "" */
    static SETUP_FINALLY = 122;	/* "" */
    
    static LOAD_FAST = 124;	/* Local variable number */
    static STORE_FAST = 125;	/* Local variable number */
    static DELETE_FAST = 126;	/* Local variable number */
    
    static RAISE_VARARGS = 130;	/* Number of raise arguments (1, 2 or 3) */
    /* CALL_FUNCTION_XXX opcodes defined below depend on this definition */
    static CALL_FUNCTION = 131;	/* #args + (#kwargs<<8) */
    static MAKE_FUNCTION = 132;	/* #defaults */
    static BUILD_SLICE = 133;	/* Number of items */
    
    static MAKE_CLOSURE = 134;     /* #free vars */
    static LOAD_CLOSURE = 135;     /* Load free variable from closure */
    static LOAD_DEREF = 136;     /* Load and dereference from closure cell */
    static STORE_DEREF = 137;     /* Store into cell */
    
    /* The next 3 opcodes must be contiguous and satisfy
        (CALL_FUNCTION_VAR - CALL_FUNCTION) & 3 == 1  */
    static CALL_FUNCTION_VAR = 140;	/* #args + (#kwargs<<8) */
    static CALL_FUNCTION_KW = 141;	/* #args + (#kwargs<<8) */
    static CALL_FUNCTION_VAR_KW = 142;	/* #args + (#kwargs<<8) */
    
    static SETUP_WITH = 143;
    
    /* Support for opargs more than 16 bits long */
    static EXTENDED_ARG = 145;
    
    static SET_ADD = 146;
    static MAP_ADD = 147;
    
    
    // enum cmp_op
    // {
    //     PyCmp_LT, PyCmp_LE, PyCmp_EQ, PyCmp_NE, PyCmp_GT, PyCmp_GE,
    //     PyCmp_IN, PyCmp_NOT_IN, PyCmp_IS, PyCmp_IS_NOT, PyCmp_EXC_MATCH, PyCmp_BAD
    // };
    
    static OpCodeList = [];

    static CompareOpNames = ["<", "<=", "==", "!=", ">", ">=", "in", "not in", "is", "is not", "exception match", "BAD"];

    Instructions = [];
    CurrentInstructionIndex = -1;

    get HasInstructionsToProcess() {
        return this.CurrentInstructionIndex < this.Instructions.length - 1;
    }

    CodeObject = [];

    get Current() {
        return this.CurrentInstructionIndex < 0 ? null : this.Instructions[this.CurrentInstructionIndex];
    }

    constructor(co)
    {
        if (!co || !co.Code || !co.Code.Value) {
            return;
        }

        this.CodeObject = co;
        let opOffset = 0;
        let opCodeID = 0;
        let extendedArg = 0;
        let code = this.CodeObject.Code.Value;

        while (opOffset < code.length) {
            opCodeID = code[opOffset++];
            let opCode = OpCodes.OpCodeList[opCodeID].Clone();
            opCode.Offset = opOffset - 1;

            if (opCode.HasArgument) {
                opCode.Argument = code[opOffset++] + code[opOffset++] * 256 + extendedArg;
                extendedArg = 0;
                
                if (opCodeID == OpCodes.EXTENDED_ARG) {
                    extendedArg = opCode.Argument * 65536;
                }

                if (opCode.HasConstant) {
                    let val = this.CodeObject.Consts.Value[opCode.Argument];
                    if (val) {
                        opCode.Constant = val.ClassName == "Py_CodeObject" ? opCode.Argument.toString() : val.ClassName == "Py_String" ? "'" + val.toString() + "'" : val.toString();
                    } else {
                        throw new Error("opCode.Argument is outside of the range")
                    }
                } else if (opCode.HasName) {
                    opCode.Name = this.CodeObject.Names.Value[opCode.Argument].toString();
                } else if (opCode.HasCompare) {
                    opCode.CompareOperator = OpCodes.CompareOpNames[opCode.Argument];
                } else if (opCode.HasLocal) {
                    opCode.LocalName = this.CodeObject.VarNames.Value[opCode.Argument].toString();
                } else if (opCode.HasFree) {
                    if (opCode.Argument < this.CodeObject.CellVars.Value.length) {
                        opCode.FreeName = this.CodeObject.CellVars.Value[opCode.Argument].toString();
                    } else if ((opCode.Argument - this.CodeObject.CellVars.Value.length) < this.CodeObject.FreeVars.Value.length) {
                        opCode.FreeName = this.CodeObject.FreeVars.Value[opCode.Argument - this.CodeObject.CellVars.Value.length].toString();
                    } else {
                        throw new Error(`ERROR: Cannot calculate Free Var for index ${opCode.Argument}`);
                    }
                }
            }
            this.Instructions.push(opCode);
        }
    }

    MoveBack() {
        if (this.CurrentInstructionIndex > 0) {
            this.CurrentInstructionIndex--;
        }
        return "";
    }

     GetNextInstruction() {
        this.CurrentInstructionIndex++;
        if (this.CurrentInstructionIndex >= this.Instructions.length) {
            return null;
        }

        return this.Instructions[this.CurrentInstructionIndex];
    }

    PeekPrevInstruction(position = 1) {
        if (this.CurrentInstructionIndex - position < 0) {
            return null;
        }

        return this.Instructions[this.CurrentInstructionIndex - position];
    }

    PeekNextInstruction(position = 1)
    {
        if (this.CurrentInstructionIndex + position >= this.Instructions.length) {
            return null;
        }

        return this.Instructions[this.CurrentInstructionIndex + position];
    }

    PeekInstructionAt(position) {
        if (position >= this.Instructions.length || position < 0) {
            return null;
        }

        return this.Instructions[position];
    }

    PeekInstructionAtOffset(offset) {
        let startPos = 0;
        if (offset > this.Instructions[this.CurrentInstructionIndex].Offset) {
            startPos = this.CurrentInstructionIndex + 1;
        }

        for (let position = startPos; position < this.Instructions.length; position++) {
            if (this.Instructions[position].Offset == offset) {
                return this.Instructions[position];
            }
        }

        return null;
    }

    PeekInstructionBeforeOffset(offset, backOffset = 1) {
        offset = this.GetIndexByOffset(offset);

        return this.PeekInstructionAt(offset - backOffset);
    }

    GetIndexByOffset(offset) {
        for (let position = 0; position < this.Instructions.length; position++) {
            if (this.Instructions[position].Offset == offset) {
                return position;
            }
        }

        return -1;
    }

    GetIndexByOpCode(opCodeID) {
        for (let position = this.CurrentInstructionIndex + 1; position < this.Instructions.length; position++) {
            if (this.Instructions[position].OpCodeID == opCodeID)
                return position;
        }

        return -1;
    }

    GetOffsetByOpCode(opCodeID) {
        for (let position = this.CurrentInstructionIndex + 1; position < this.Instructions.length; position++) {
            if (this.Instructions[position].OpCodeID == opCodeID)
                return this.Instructions[position].Offset;
        }

        return -1;
    }

    GetReversedOffsetByOpCode(opCodeID, startOffset = -1, endOffset = -1) {
        let startPosition = this.CurrentInstructionIndex - 1;
        let endPosition = 0;

        if (startOffset > 0) {
            startPosition = this.GetIndexByOffset(startOffset);
        }

        if (startPosition < 0 && startPosition >= this.Instructions.length) {
            return -1;
        }

        if (endOffset > 0) {
            endPosition = this.GetIndexByOffset(endOffset);
        }

        if (endPosition < 0 && endPosition >= this.Instructions.length) {
            return -1;
        }

        for (let position = startPosition; position >= endPosition; position--) {
            if (this.Instructions[position].OpCodeID == opCodeID)
                return this.Instructions[position].Offset;
        }

        return -1;
    }

    SkipInstruction(offset = 1) {
        this.CurrentInstructionIndex += offset;
    }

    GetOffsetByOpCodeName(opName) {
        for (let position = this.CurrentInstructionIndex + 1; position < this.Instructions.length; position++) {
            if (this.Instructions[position].InstructionName.startsWith(opName)) {
                return this.Instructions[position].Offset;
            }
        }

        return -1;
    }

    GetBackOffsetByOpCodeName(opName) {
        for (let position = this.CurrentInstructionIndex - 1; position >= 0; position--) {
            if (this.Instructions[position].InstructionName.startsWith(opName)) {
                return this.Instructions[position].Offset;
            }
        }

        return -1;
    }

    GetLineOffsetRangeForOffset(offset) {
        let startOffset = this.GetIndexByOffset(offset);
        let endOffset = startOffset;
        let line = this.CodeObject.LineNoTab[offset];

        while (startOffset > 0) {
            startOffset--;
            if (this.CodeObject.LineNoTab[this.Instructions[startOffset].Offset] != line) {
                startOffset++;
                break;
            }
        }

        while (endOffset < this.Instructions.length - 1) {
            endOffset++;
            if (this.CodeObject.LineNoTab[this.Instructions[endOffset].Offset] != line) {
                endOffset--;
                break;
            }
        }

        startOffset = this.Instructions[startOffset].Offset;
        endOffset = this.Instructions[endOffset].Offset;

        return [line, startOffset, endOffset];
    }

    CountSpecificOpCodes(opCodes, offset = -1, endOffset = -1) {
        let startPos = offset == -1 ? 0 : this.GetIndexByOffset(offset);
        let endPos = endOffset == -1 ? this.Instructions.length : this.GetIndexByOffset(endOffset);
        let count = 0;

        if (!Array.isArray(opCodes)) {
            opCodes = [opCodes];
        }

        for (let position = startPos; position < endPos; position++) {
            if (opCodes.includes(this.Instructions[position].OpCodeID)) {
                count++;
            }
        }

        return count;
    }

    CheckIfOpCodesExistsInLine(opCodes, startOffset, endOffset) {
        let startPosition = this.GetIndexByOffset(startOffset);
        let endPosition = this.GetIndexByOffset(endOffset);
        let mapExists = {};

        for (let opCode of opCodes) {
            mapExists[opCode] = false;
        }

        for (let position = startPosition; position <= endPosition; position++) {
            if (opCodes.includes(this.Instructions[position].OpCodeID)) {
                mapExists[this.Instructions[position].OpCodeID] = true;
            }
        }

        for (let item of Object.values(mapExists)) {
            if (item == false) {
                return false;
            }
        }
        return true;
    }

}

const opcodes = [new OpCode(OpCodes.STOP_CODE, "STOP_CODE"),
    new OpCode(OpCodes.POP_TOP, "POP_TOP"),
    new OpCode(OpCodes.ROT_TWO, "ROT_TWO"),
    new OpCode(OpCodes.ROT_THREE, "ROT_THREE"),
    new OpCode(OpCodes.DUP_TOP, "DUP_TOP"),
    new OpCode(OpCodes.ROT_FOUR, "ROT_FOUR"),
    new OpCode(OpCodes.NOP, "NOP"),
    new OpCode(OpCodes.UNARY_POSITIVE, "UNARY_POSITIVE"),
    new OpCode(OpCodes.UNARY_NEGATIVE, "UNARY_NEGATIVE"),
    new OpCode(OpCodes.UNARY_NOT, "UNARY_NOT"),
    new OpCode(OpCodes.UNARY_CONVERT, "UNARY_CONVERT"),
    new OpCode(OpCodes.UNARY_INVERT, "UNARY_INVERT"),
    new OpCode(OpCodes.BINARY_POWER, "BINARY_POWER"),
    new OpCode(OpCodes.BINARY_MULTIPLY, "BINARY_MULTIPLY"),
    new OpCode(OpCodes.BINARY_DIVIDE, "BINARY_DIVIDE"),
    new OpCode(OpCodes.BINARY_MODULO, "BINARY_MODULO"),
    new OpCode(OpCodes.BINARY_ADD, "BINARY_ADD"),
    new OpCode(OpCodes.BINARY_SUBTRACT, "BINARY_SUBTRACT"),
    new OpCode(OpCodes.BINARY_SUBSCR, "BINARY_SUBSCR"),
    new OpCode(OpCodes.BINARY_FLOOR_DIVIDE, "BINARY_FLOOR_DIVIDE"),
    new OpCode(OpCodes.BINARY_TRUE_DIVIDE, "BINARY_TRUE_DIVIDE"),
    new OpCode(OpCodes.INPLACE_FLOOR_DIVIDE, "INPLACE_FLOOR_DIVIDE"),
    new OpCode(OpCodes.INPLACE_TRUE_DIVIDE, "INPLACE_TRUE_DIVIDE"),
    new OpCode(OpCodes.SLICE, "SLICE"),
    new OpCode(OpCodes.SLICE1, "SLICE1"),
    new OpCode(OpCodes.SLICE2, "SLICE2"),
    new OpCode(OpCodes.SLICE3, "SLICE3"),
    new OpCode(OpCodes.STORE_SLICE, "STORE_SLICE"),
    new OpCode(OpCodes.STORE_SLICE1, "STORE_SLICE1"),
    new OpCode(OpCodes.STORE_SLICE2, "STORE_SLICE2"),
    new OpCode(OpCodes.STORE_SLICE3, "STORE_SLICE3"),
    new OpCode(OpCodes.DELETE_SLICE, "DELETE_SLICE"),
    new OpCode(OpCodes.DELETE_SLICE1, "DELETE_SLICE1"),
    new OpCode(OpCodes.DELETE_SLICE2, "DELETE_SLICE2"),
    new OpCode(OpCodes.DELETE_SLICE3, "DELETE_SLICE3"),
    new OpCode(OpCodes.STORE_MAP, "STORE_MAP"),
    new OpCode(OpCodes.INPLACE_ADD, "INPLACE_ADD"),
    new OpCode(OpCodes.INPLACE_SUBTRACT, "INPLACE_SUBTRACT"),
    new OpCode(OpCodes.INPLACE_MULTIPLY, "INPLACE_MULTIPLY"),
    new OpCode(OpCodes.INPLACE_DIVIDE, "INPLACE_DIVIDE"),
    new OpCode(OpCodes.INPLACE_MODULO, "INPLACE_MODULO"),
    new OpCode(OpCodes.STORE_SUBSCR, "STORE_SUBSCR"),
    new OpCode(OpCodes.DELETE_SUBSCR, "DELETE_SUBSCR"),
    new OpCode(OpCodes.BINARY_LSHIFT, "BINARY_LSHIFT"),
    new OpCode(OpCodes.BINARY_RSHIFT, "BINARY_RSHIFT"),
    new OpCode(OpCodes.BINARY_AND, "BINARY_AND"),
    new OpCode(OpCodes.BINARY_XOR, "BINARY_XOR"),
    new OpCode(OpCodes.BINARY_OR, "BINARY_OR"),
    new OpCode(OpCodes.INPLACE_POWER, "INPLACE_POWER"),
    new OpCode(OpCodes.GET_ITER, "GET_ITER"),
    new OpCode(OpCodes.PRINT_EXPR, "PRINT_EXPR"),
    new OpCode(OpCodes.PRINT_ITEM, "PRINT_ITEM"),
    new OpCode(OpCodes.PRINT_NEWLINE, "PRINT_NEWLINE"),
    new OpCode(OpCodes.PRINT_ITEM_TO, "PRINT_ITEM_TO"),
    new OpCode(OpCodes.PRINT_NEWLINE_TO, "PRINT_NEWLINE_TO"),
    new OpCode(OpCodes.INPLACE_LSHIFT, "INPLACE_LSHIFT"),
    new OpCode(OpCodes.INPLACE_RSHIFT, "INPLACE_RSHIFT"),
    new OpCode(OpCodes.INPLACE_AND, "INPLACE_AND"),
    new OpCode(OpCodes.INPLACE_XOR, "INPLACE_XOR"),
    new OpCode(OpCodes.INPLACE_OR, "INPLACE_OR"),
    new OpCode(OpCodes.BREAK_LOOP, "BREAK_LOOP"),
    new OpCode(OpCodes.WITH_CLEANUP, "WITH_CLEANUP"),
    new OpCode(OpCodes.LOAD_LOCALS, "LOAD_LOCALS"),
    new OpCode(OpCodes.RETURN_VALUE, "RETURN_VALUE"),
    new OpCode(OpCodes.IMPORT_STAR, "IMPORT_STAR"),
    new OpCode(OpCodes.EXEC_STMT, "EXEC_STMT"),
    new OpCode(OpCodes.YIELD_VALUE, "YIELD_VALUE"),
    new OpCode(OpCodes.POP_BLOCK, "POP_BLOCK"),
    new OpCode(OpCodes.END_FINALLY, "END_FINALLY"),
    new OpCode(OpCodes.BUILD_CLASS, "BUILD_CLASS"),
    new OpCode(OpCodes.STORE_NAME, "STORE_NAME", { HasArgument: true, HasName: true}),
    new OpCode(OpCodes.DELETE_NAME, "DELETE_NAME", { HasArgument: true, HasName: true}),
    new OpCode(OpCodes.UNPACK_SEQUENCE, "UNPACK_SEQUENCE", { HasArgument: true}),
    new OpCode(OpCodes.FOR_ITER, "FOR_ITER", { HasArgument: true, HasJumpRelative: true}),
    new OpCode(OpCodes.LIST_APPEND, "LIST_APPEND", { HasArgument: true}),
    new OpCode(OpCodes.STORE_ATTR, "STORE_ATTR", { HasArgument: true, HasName: true}),
    new OpCode(OpCodes.DELETE_ATTR, "DELETE_ATTR", { HasArgument: true, HasName: true}),
    new OpCode(OpCodes.STORE_GLOBAL, "STORE_GLOBAL", { HasArgument: true, HasName: true}),
    new OpCode(OpCodes.DELETE_GLOBAL, "DELETE_GLOBAL", { HasArgument: true, HasName: true}),
    new OpCode(OpCodes.DUP_TOPX, "DUP_TOPX", { HasArgument: true}),
    new OpCode(OpCodes.LOAD_CONST, "LOAD_CONST", { HasArgument: true, HasConstant: true}),
    new OpCode(OpCodes.LOAD_NAME, "LOAD_NAME", { HasArgument: true, HasName: true}),
    new OpCode(OpCodes.BUILD_TUPLE, "BUILD_TUPLE", { HasArgument: true}),
    new OpCode(OpCodes.BUILD_LIST, "BUILD_LIST", { HasArgument: true}),
    new OpCode(OpCodes.BUILD_SET, "BUILD_SET", { HasArgument: true}),
    new OpCode(OpCodes.BUILD_MAP, "BUILD_MAP", { HasArgument: true}),
    new OpCode(OpCodes.LOAD_ATTR, "LOAD_ATTR", { HasArgument: true, HasName: true}),
    new OpCode(OpCodes.COMPARE_OP, "COMPARE_OP", { HasArgument: true, HasCompare: true}),
    new OpCode(OpCodes.IMPORT_NAME, "IMPORT_NAME", { HasArgument: true, HasName: true}),
    new OpCode(OpCodes.IMPORT_FROM, "IMPORT_FROM", { HasArgument: true, HasName: true}),
    new OpCode(OpCodes.JUMP_FORWARD, "JUMP_FORWARD", { HasArgument: true, HasJumpRelative: true}),
    new OpCode(OpCodes.JUMP_IF_FALSE_OR_POP, "JUMP_IF_FALSE_OR_POP", { HasArgument: true, HasJumpAbsolute: true}),
    new OpCode(OpCodes.JUMP_IF_TRUE_OR_POP, "JUMP_IF_TRUE_OR_POP", { HasArgument: true, HasJumpAbsolute: true}),
    new OpCode(OpCodes.JUMP_ABSOLUTE, "JUMP_ABSOLUTE", { HasArgument: true, HasJumpAbsolute: true}),
    new OpCode(OpCodes.POP_JUMP_IF_FALSE, "POP_JUMP_IF_FALSE", { HasArgument: true, HasJumpAbsolute: true}),
    new OpCode(OpCodes.POP_JUMP_IF_TRUE, "POP_JUMP_IF_TRUE", { HasArgument: true, HasJumpAbsolute: true}),
    new OpCode(OpCodes.LOAD_GLOBAL, "LOAD_GLOBAL", { HasArgument: true, HasName: true}),
    new OpCode(OpCodes.CONTINUE_LOOP, "CONTINUE_LOOP", { HasArgument: true, HasJumpAbsolute: true}),
    new OpCode(OpCodes.SETUP_LOOP, "SETUP_LOOP", { HasArgument: true, HasJumpRelative: true}),
    new OpCode(OpCodes.SETUP_EXCEPT, "SETUP_EXCEPT", { HasArgument: true, HasJumpRelative: true}),
    new OpCode(OpCodes.SETUP_FINALLY, "SETUP_FINALLY", { HasArgument: true, HasJumpRelative: true}),
    new OpCode(OpCodes.LOAD_FAST, "LOAD_FAST", { HasArgument: true, HasLocal: true}),
    new OpCode(OpCodes.STORE_FAST, "STORE_FAST", { HasArgument: true, HasLocal: true}),
    new OpCode(OpCodes.DELETE_FAST, "DELETE_FAST", { HasArgument: true, HasLocal: true}),
    new OpCode(OpCodes.RAISE_VARARGS, "RAISE_VARARGS", { HasArgument: true}),
    new OpCode(OpCodes.CALL_FUNCTION, "CALL_FUNCTION", { HasArgument: true}),
    new OpCode(OpCodes.MAKE_FUNCTION, "MAKE_FUNCTION", { HasArgument: true}),
    new OpCode(OpCodes.BUILD_SLICE, "BUILD_SLICE", { HasArgument: true}),
    new OpCode(OpCodes.MAKE_CLOSURE, "MAKE_CLOSURE", { HasArgument: true}),
    new OpCode(OpCodes.LOAD_CLOSURE, "LOAD_CLOSURE", { HasArgument: true, HasFree: true}),
    new OpCode(OpCodes.LOAD_DEREF, "LOAD_DEREF", { HasArgument: true, HasFree: true}),
    new OpCode(OpCodes.STORE_DEREF, "STORE_DEREF", { HasArgument: true, HasFree: true}),
    new OpCode(OpCodes.CALL_FUNCTION_VAR, "CALL_FUNCTION_VAR", { HasArgument: true}),
    new OpCode(OpCodes.CALL_FUNCTION_KW, "CALL_FUNCTION_KW", { HasArgument: true}),
    new OpCode(OpCodes.CALL_FUNCTION_VAR_KW, "CALL_FUNCTION_VAR_KW", { HasArgument: true}),
    new OpCode(OpCodes.SETUP_WITH, "SETUP_WITH", { HasArgument: true, HasJumpRelative: true}),
    new OpCode(OpCodes.EXTENDED_ARG, "EXTENDED_ARG", { HasArgument: true}),
    new OpCode(OpCodes.SET_ADD, "SET_ADD", { HasArgument: true}),
    new OpCode(OpCodes.MAP_ADD, "MAP_ADD", { HasArgument: true})
];

for (let opcode of opcodes) {
    OpCodes.OpCodeList[opcode.OpCodeID] = opcode;
}

module.exports = OpCodes;