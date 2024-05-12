const OpCode = require('../OpCode');
const OpCodes = require('../OpCodes');

const opcodes = [
    [0, new OpCode(OpCodes.STOP_CODE, "STOP_CODE")],
    [1, new OpCode(OpCodes.POP_TOP, "POP_TOP")],
    [2, new OpCode(OpCodes.ROT_TWO, "ROT_TWO")],
    [3, new OpCode(OpCodes.ROT_THREE, "ROT_THREE")],
    [4, new OpCode(OpCodes.DUP_TOP, "DUP_TOP")],
    [5, new OpCode(OpCodes.ROT_FOUR, "ROT_FOUR")],
    
    [10, new OpCode(OpCodes.UNARY_POSITIVE, "UNARY_POSITIVE")],
    [11, new OpCode(OpCodes.UNARY_NEGATIVE, "UNARY_NEGATIVE")],
    [12, new OpCode(OpCodes.UNARY_NOT, "UNARY_NOT")],
    [13, new OpCode(OpCodes.UNARY_CONVERT, "UNARY_CONVERT")],
    
    [15, new OpCode(OpCodes.UNARY_INVERT, "UNARY_INVERT")],
    
    [19, new OpCode(OpCodes.BINARY_POWER, "BINARY_POWER")],
    [20, new OpCode(OpCodes.BINARY_MULTIPLY, "BINARY_MULTIPLY")],
    [21, new OpCode(OpCodes.BINARY_DIVIDE, "BINARY_DIVIDE")],
    [22, new OpCode(OpCodes.BINARY_MODULO, "BINARY_MODULO")],
    [23, new OpCode(OpCodes.BINARY_ADD, "BINARY_ADD")],
    [24, new OpCode(OpCodes.BINARY_SUBTRACT, "BINARY_SUBTRACT")],
    [25, new OpCode(OpCodes.BINARY_SUBSCR, "BINARY_SUBSCR")],
    
    [30, new OpCode(OpCodes.SLICE_0, "SLICE_0")],
    [31, new OpCode(OpCodes.SLICE_1, "SLICE_1")],
    [32, new OpCode(OpCodes.SLICE_2, "SLICE_2")],
    [33, new OpCode(OpCodes.SLICE_3, "SLICE_3")],

    [40, new OpCode(OpCodes.STORE_SLICE_0, "STORE_SLICE_0")],
    [41, new OpCode(OpCodes.STORE_SLICE_1, "STORE_SLICE_1")],
    [42, new OpCode(OpCodes.STORE_SLICE_2, "STORE_SLICE_2")],
    [43, new OpCode(OpCodes.STORE_SLICE_3, "STORE_SLICE_3")],
    
    [50, new OpCode(OpCodes.DELETE_SLICE_0, "DELETE_SLICE_0")],
    [51, new OpCode(OpCodes.DELETE_SLICE_1, "DELETE_SLICE_1")],
    [52, new OpCode(OpCodes.DELETE_SLICE_2, "DELETE_SLICE_2")],
    [53, new OpCode(OpCodes.DELETE_SLICE_3, "DELETE_SLICE_3")],
    
    [55, new OpCode(OpCodes.INPLACE_ADD, "INPLACE_ADD")],
    [56, new OpCode(OpCodes.INPLACE_SUBTRACT, "INPLACE_SUBTRACT")],
    [57, new OpCode(OpCodes.INPLACE_MULTIPLY, "INPLACE_MULTIPLY")],
    [58, new OpCode(OpCodes.INPLACE_DIVIDE, "INPLACE_DIVIDE")],
    [59, new OpCode(OpCodes.INPLACE_MODULO, "INPLACE_MODULO")],
    [60, new OpCode(OpCodes.STORE_SUBSCR, "STORE_SUBSCR")],
    [61, new OpCode(OpCodes.DELETE_SUBSCR, "DELETE_SUBSCR")],
    [62, new OpCode(OpCodes.BINARY_LSHIFT, "BINARY_LSHIFT")],
    [63, new OpCode(OpCodes.BINARY_RSHIFT, "BINARY_RSHIFT")],
    [64, new OpCode(OpCodes.BINARY_AND, "BINARY_AND")],
    [65, new OpCode(OpCodes.BINARY_XOR, "BINARY_XOR")],
    [66, new OpCode(OpCodes.BINARY_OR, "BINARY_OR")],
    [67, new OpCode(OpCodes.INPLACE_POWER, "INPLACE_POWER")],
    
    [70, new OpCode(OpCodes.PRINT_EXPR, "PRINT_EXPR")],
    [71, new OpCode(OpCodes.PRINT_ITEM, "PRINT_ITEM")],
    [72, new OpCode(OpCodes.PRINT_NEWLINE, "PRINT_NEWLINE")],
    [73, new OpCode(OpCodes.PRINT_ITEM_TO, "PRINT_ITEM_TO")],
    [74, new OpCode(OpCodes.PRINT_NEWLINE_TO, "PRINT_NEWLINE_TO")],
    [75, new OpCode(OpCodes.INPLACE_LSHIFT, "INPLACE_LSHIFT")],
    [76, new OpCode(OpCodes.INPLACE_RSHIFT, "INPLACE_RSHIFT")],
    [77, new OpCode(OpCodes.INPLACE_AND, "INPLACE_AND")],
    [78, new OpCode(OpCodes.INPLACE_XOR, "INPLACE_XOR")],
    [79, new OpCode(OpCodes.INPLACE_OR, "INPLACE_OR")],    
    [80, new OpCode(OpCodes.BREAK_LOOP, "BREAK_LOOP")],

    [82, new OpCode(OpCodes.LOAD_LOCALS, "LOAD_LOCALS")],
    [83, new OpCode(OpCodes.RETURN_VALUE, "RETURN_VALUE")],
    [84, new OpCode(OpCodes.IMPORT_STAR, "IMPORT_STAR")],
    [85, new OpCode(OpCodes.EXEC_STMT, "EXEC_STMT")],

    [87, new OpCode(OpCodes.POP_BLOCK, "POP_BLOCK")],
    [88, new OpCode(OpCodes.END_FINALLY, "END_FINALLY")],
    [89, new OpCode(OpCodes.BUILD_CLASS, "BUILD_CLASS")],
    [90, new OpCode(OpCodes.STORE_NAME_A, "STORE_NAME", {HasArgument: true, HasName: true})],
    [91, new OpCode(OpCodes.DELETE_NAME_A, "DELETE_NAME", {HasArgument: true, HasName: true})],
    [92, new OpCode(OpCodes.UNPACK_SEQUENCE_A, "UNPACK_SEQUENCE", {HasArgument: true})],
    
    [95, new OpCode(OpCodes.STORE_ATTR_A, "STORE_ATTR", {HasArgument: true, HasName: true})],
    [96, new OpCode(OpCodes.DELETE_ATTR_A, "DELETE_ATTR", {HasArgument: true, HasName: true})],
    [97, new OpCode(OpCodes.STORE_GLOBAL_A, "STORE_GLOBAL", {HasArgument: true, HasName: true})],
    [98, new OpCode(OpCodes.DELETE_GLOBAL_A, "DELETE_GLOBAL", {HasArgument: true, HasName: true})],
    [99, new OpCode(OpCodes.DUP_TOPX_A, "DUP_TOPX", {HasArgument: true})],
    [100, new OpCode(OpCodes.LOAD_CONST_A, "LOAD_CONST", {HasArgument: true, HasConstant: true})],
    [101, new OpCode(OpCodes.LOAD_NAME_A, "LOAD_NAME", {HasArgument: true, HasName: true})],
    [102, new OpCode(OpCodes.BUILD_TUPLE_A, "BUILD_TUPLE", {HasArgument: true})],
    [103, new OpCode(OpCodes.BUILD_LIST_A, "BUILD_LIST", {HasArgument: true})],
    [104, new OpCode(OpCodes.BUILD_MAP_A, "BUILD_MAP", {HasArgument: true})],
    [105, new OpCode(OpCodes.LOAD_ATTR_A, "LOAD_ATTR", {HasArgument: true, HasName: true})],
    [106, new OpCode(OpCodes.COMPARE_OP_A, "COMPARE_OP", {HasArgument: true, HasCompare: true})],
    [107, new OpCode(OpCodes.IMPORT_NAME_A, "IMPORT_NAME", {HasArgument: true, HasName: true})],
    [108, new OpCode(OpCodes.IMPORT_FROM_A, "IMPORT_FROM", {HasArgument: true, HasName: true})],
    
    [110, new OpCode(OpCodes.JUMP_FORWARD_A, "JUMP_FORWARD", {HasArgument: true, HasJumpRelative: true})],
    [111, new OpCode(OpCodes.JUMP_IF_FALSE_A, "JUMP_IF_FALSE", {HasArgument: true, HasJumpRelative: true})],
    [112, new OpCode(OpCodes.JUMP_IF_TRUE_A, "JUMP_IF_TRUE", {HasArgument: true, HasJumpRelative: true})],
    [113, new OpCode(OpCodes.JUMP_ABSOLUTE_A, "JUMP_ABSOLUTE", {HasArgument: true, HasJumpAbsolute: true})],
    [114, new OpCode(OpCodes.FOR_LOOP_A, "FOR_LOOP", {HasArgument: true, HasJumpRelative: true})],
    
    [116, new OpCode(OpCodes.LOAD_GLOBAL_A, "LOAD_GLOBAL", {HasArgument: true, HasName: true})],
    
    [119, new OpCode(OpCodes.CONTINUE_LOOP_A, "CONTINUE_LOOP", {HasArgument: true, HasJumpAbsolute: true})],
    [120, new OpCode(OpCodes.SETUP_LOOP_A, "SETUP_LOOP", {HasArgument: true, HasJumpRelative: true})],
    [121, new OpCode(OpCodes.SETUP_EXCEPT_A, "SETUP_EXCEPT", {HasArgument: true, HasJumpRelative: true})],
    [122, new OpCode(OpCodes.SETUP_FINALLY_A, "SETUP_FINALLY", {HasArgument: true, HasJumpRelative: true})],
    
    [124, new OpCode(OpCodes.LOAD_FAST_A, "LOAD_FAST", {HasArgument: true, HasLocal: true})],
    [125, new OpCode(OpCodes.STORE_FAST_A, "STORE_FAST", {HasArgument: true, HasLocal: true})],
    [126, new OpCode(OpCodes.DELETE_FAST_A, "DELETE_FAST", {HasArgument: true, HasLocal: true})],
    [127, new OpCode(OpCodes.SET_LINENO_A, "SET_LINENO", {HasArgument: true})],

    [130, new OpCode(OpCodes.RAISE_VARARGS_A, "RAISE_VARARGS", {HasArgument: true})],
    [131, new OpCode(OpCodes.CALL_FUNCTION_A, "CALL_FUNCTION", {HasArgument: true})],
    [132, new OpCode(OpCodes.MAKE_FUNCTION_A, "MAKE_FUNCTION", {HasArgument: true})],
    [133, new OpCode(OpCodes.BUILD_SLICE_A, "BUILD_SLICE", {HasArgument: true})],
    [134, new OpCode(OpCodes.MAKE_CLOSURE_A, "MAKE_CLOSURE", {HasArgument: true})],
    [135, new OpCode(OpCodes.LOAD_CLOSURE_A, "LOAD_CLOSURE", {HasArgument: true, HasFree: true})],
    [136, new OpCode(OpCodes.LOAD_DEREF_A, "LOAD_DEREF", {HasArgument: true, HasFree: true})],
    [137, new OpCode(OpCodes.STORE_DEREF_A, "STORE_DEREF", {HasArgument: true, HasFree: true})],

    [140, new OpCode(OpCodes.CALL_FUNCTION_VAR_A, "CALL_FUNCTION_VAR", {HasArgument: true})],
    [141, new OpCode(OpCodes.CALL_FUNCTION_KW_A, "CALL_FUNCTION_KW", {HasArgument: true})],
    [142, new OpCode(OpCodes.CALL_FUNCTION_VAR_KW_A, "CALL_FUNCTION_VAR_KW", {HasArgument: true})],
    [143, new OpCode(OpCodes.EXTENDED_ARG_A, "EXTENDED_ARG", {HasArgument: true})]
];

class Python2_1_OpCodes extends OpCodes {
    constructor(co) {
        super();
        this.PopulateOpCodes(opcodes);
        this.SetupByteCode(co);
    }

    PopulateOpCodes(opCodeList) {
        for (let [idx, opcode] of opCodeList) {
            this.OpCodeList[idx] = opcode;
        }
    }
}

module.exports = Python2_1_OpCodes;
