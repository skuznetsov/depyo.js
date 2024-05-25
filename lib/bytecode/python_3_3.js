const OpCode = require('../OpCode');
const OpCodes = require('../OpCodes');

const opcodes = [
    [1, new OpCode(OpCodes.POP_TOP, "POP_TOP")],
    [2, new OpCode(OpCodes.ROT_TWO, "ROT_TWO")],
    [3, new OpCode(OpCodes.ROT_THREE, "ROT_THREE")],
    [4, new OpCode(OpCodes.DUP_TOP, "DUP_TOP")],
    [5, new OpCode(OpCodes.DUP_TOP_TWO, "DUP_TOP_TWO")],
    
    [9, new OpCode(OpCodes.NOP, "NOP")],
    [10, new OpCode(OpCodes.UNARY_POSITIVE, "UNARY_POSITIVE")],
    [11, new OpCode(OpCodes.UNARY_NEGATIVE, "UNARY_NEGATIVE")],
    [12, new OpCode(OpCodes.UNARY_NOT, "UNARY_NOT")],
    
    [15, new OpCode(OpCodes.UNARY_INVERT, "UNARY_INVERT")],
    
    [19, new OpCode(OpCodes.BINARY_POWER, "BINARY_POWER")],
    [20, new OpCode(OpCodes.BINARY_MULTIPLY, "BINARY_MULTIPLY")],
    
    [22, new OpCode(OpCodes.BINARY_MODULO, "BINARY_MODULO")],
    [23, new OpCode(OpCodes.BINARY_ADD, "BINARY_ADD")],
    [24, new OpCode(OpCodes.BINARY_SUBTRACT, "BINARY_SUBTRACT")],
    [25, new OpCode(OpCodes.BINARY_SUBSCR, "BINARY_SUBSCR")],
    [26, new OpCode(OpCodes.BINARY_FLOOR_DIVIDE, "BINARY_FLOOR_DIVIDE")],
    [27, new OpCode(OpCodes.BINARY_TRUE_DIVIDE, "BINARY_TRUE_DIVIDE")],
    [28, new OpCode(OpCodes.INPLACE_FLOOR_DIVIDE, "INPLACE_FLOOR_DIVIDE")],
    [29, new OpCode(OpCodes.INPLACE_TRUE_DIVIDE, "INPLACE_TRUE_DIVIDE")],

    [54, new OpCode(OpCodes.STORE_MAP, "STORE_MAP")],
    [55, new OpCode(OpCodes.INPLACE_ADD, "INPLACE_ADD")],
    [56, new OpCode(OpCodes.INPLACE_SUBTRACT, "INPLACE_SUBTRACT")],
    [57, new OpCode(OpCodes.INPLACE_MULTIPLY, "INPLACE_MULTIPLY")],

    [59, new OpCode(OpCodes.INPLACE_MODULO, "INPLACE_MODULO")],
    [60, new OpCode(OpCodes.STORE_SUBSCR, "STORE_SUBSCR")],
    [61, new OpCode(OpCodes.DELETE_SUBSCR, "DELETE_SUBSCR")],
    [62, new OpCode(OpCodes.BINARY_LSHIFT, "BINARY_LSHIFT")],
    [63, new OpCode(OpCodes.BINARY_RSHIFT, "BINARY_RSHIFT")],
    [64, new OpCode(OpCodes.BINARY_AND, "BINARY_AND")],
    [65, new OpCode(OpCodes.BINARY_XOR, "BINARY_XOR")],
    [66, new OpCode(OpCodes.BINARY_OR, "BINARY_OR")],
    [67, new OpCode(OpCodes.INPLACE_POWER, "INPLACE_POWER")],
    [68, new OpCode(OpCodes.GET_ITER, "GET_ITER")],
    [69, new OpCode(OpCodes.STORE_LOCALS, "STORE_LOCALS")],
    [70, new OpCode(OpCodes.PRINT_EXPR, "PRINT_EXPR")],
    [71, new OpCode(OpCodes.LOAD_BUILD_CLASS, "LOAD_BUILD_CLASS")],
    [72, new OpCode(OpCodes.YIELD_FROM, "YIELD_FROM")],

    [75, new OpCode(OpCodes.INPLACE_LSHIFT, "INPLACE_LSHIFT")],
    [76, new OpCode(OpCodes.INPLACE_RSHIFT, "INPLACE_RSHIFT")],
    [77, new OpCode(OpCodes.INPLACE_AND, "INPLACE_AND")],
    [78, new OpCode(OpCodes.INPLACE_XOR, "INPLACE_XOR")],
    [79, new OpCode(OpCodes.INPLACE_OR, "INPLACE_OR")],    
    [80, new OpCode(OpCodes.BREAK_LOOP, "BREAK_LOOP")],
    [81, new OpCode(OpCodes.WITH_CLEANUP, "WITH_CLEANUP")],

    [83, new OpCode(OpCodes.RETURN_VALUE, "RETURN_VALUE")],
    [84, new OpCode(OpCodes.IMPORT_STAR, "IMPORT_STAR")],

    [86, new OpCode(OpCodes.YIELD_VALUE, "YIELD_VALUE")],
    [87, new OpCode(OpCodes.POP_BLOCK, "POP_BLOCK")],
    [88, new OpCode(OpCodes.END_FINALLY, "END_FINALLY")],
    [89, new OpCode(OpCodes.POP_EXCEPT, "POP_EXCEPT")],
    [90, new OpCode(OpCodes.STORE_NAME_A, "STORE_NAME", {HasArgument: true, HasName: true})],
    [91, new OpCode(OpCodes.DELETE_NAME_A, "DELETE_NAME", {HasArgument: true, HasName: true})],
    [92, new OpCode(OpCodes.UNPACK_SEQUENCE_A, "UNPACK_SEQUENCE", {HasArgument: true})],
    [93, new OpCode(OpCodes.FOR_ITER_A, "FOR_ITER", {HasArgument: true, HasJumpRelative: true})],
    [94, new OpCode(OpCodes.UNPACK_EX_A, "UNPACK_EX", {HasArgument: true})],
    [95, new OpCode(OpCodes.STORE_ATTR_A, "STORE_ATTR", {HasArgument: true, HasName: true})],
    [96, new OpCode(OpCodes.DELETE_ATTR_A, "DELETE_ATTR", {HasArgument: true, HasName: true})],
    [97, new OpCode(OpCodes.STORE_GLOBAL_A, "STORE_GLOBAL", {HasArgument: true, HasName: true})],
    [98, new OpCode(OpCodes.DELETE_GLOBAL_A, "DELETE_GLOBAL", {HasArgument: true, HasName: true})],

    [100, new OpCode(OpCodes.LOAD_CONST_A, "LOAD_CONST", {HasArgument: true, HasConstant: true})],
    [101, new OpCode(OpCodes.LOAD_NAME_A, "LOAD_NAME", {HasArgument: true, HasName: true})],
    [102, new OpCode(OpCodes.BUILD_TUPLE_A, "BUILD_TUPLE", {HasArgument: true})],
    [103, new OpCode(OpCodes.BUILD_LIST_A, "BUILD_LIST", {HasArgument: true})],
    [104, new OpCode(OpCodes.BUILD_SET_A, "BUILD_SET", {HasArgument: true})],
    [105, new OpCode(OpCodes.BUILD_MAP_A, "BUILD_MAP", {HasArgument: true})],
    [106, new OpCode(OpCodes.LOAD_ATTR_A, "LOAD_ATTR", {HasArgument: true, HasName: true})],
    [107, new OpCode(OpCodes.COMPARE_OP_A, "COMPARE_OP", {HasArgument: true, HasCompare: true})],
    [108, new OpCode(OpCodes.IMPORT_NAME_A, "IMPORT_NAME", {HasArgument: true, HasName: true})],
    [109, new OpCode(OpCodes.IMPORT_FROM_A, "IMPORT_FROM", {HasArgument: true, HasName: true})],
    [110, new OpCode(OpCodes.JUMP_FORWARD_A, "JUMP_FORWARD", {HasArgument: true, HasJumpRelative: true})],
    [111, new OpCode(OpCodes.JUMP_IF_FALSE_OR_POP_A, "JUMP_IF_FALSE_OR_POP", {HasArgument: true, HasJumpAbsolute: true})],
    [112, new OpCode(OpCodes.JUMP_IF_TRUE_OR_POP_A, "JUMP_IF_TRUE_OR_POP", {HasArgument: true, HasJumpAbsolute: true})],
    [113, new OpCode(OpCodes.JUMP_ABSOLUTE_A, "JUMP_ABSOLUTE", {HasArgument: true, HasJumpAbsolute: true})],
    [114, new OpCode(OpCodes.POP_JUMP_IF_FALSE_A, "POP_JUMP_IF_FALSE", {HasArgument: true, HasJumpAbsolute: true})],
    [115, new OpCode(OpCodes.POP_JUMP_IF_TRUE_A, "POP_JUMP_IF_TRUE", {HasArgument: true, HasJumpAbsolute: true})],
    [116, new OpCode(OpCodes.LOAD_GLOBAL_A, "LOAD_GLOBAL", {HasArgument: true, HasName: true})],
    
    [119, new OpCode(OpCodes.CONTINUE_LOOP_A, "CONTINUE_LOOP", {HasArgument: true, HasJumpAbsolute: true})],
    [120, new OpCode(OpCodes.SETUP_LOOP_A, "SETUP_LOOP", {HasArgument: true, HasJumpRelative: true})],
    [121, new OpCode(OpCodes.SETUP_EXCEPT_A, "SETUP_EXCEPT", {HasArgument: true, HasJumpRelative: true})],
    [122, new OpCode(OpCodes.SETUP_FINALLY_A, "SETUP_FINALLY", {HasArgument: true, HasJumpRelative: true})],
    
    [124, new OpCode(OpCodes.LOAD_FAST_A, "LOAD_FAST", {HasArgument: true, HasLocal: true})],
    [125, new OpCode(OpCodes.STORE_FAST_A, "STORE_FAST", {HasArgument: true, HasLocal: true})],
    [126, new OpCode(OpCodes.DELETE_FAST_A, "DELETE_FAST", {HasArgument: true, HasLocal: true})],

    [130, new OpCode(OpCodes.RAISE_VARARGS_A, "RAISE_VARARGS", {HasArgument: true})],
    [131, new OpCode(OpCodes.CALL_FUNCTION_A, "CALL_FUNCTION", {HasArgument: true})],
    [132, new OpCode(OpCodes.MAKE_FUNCTION_A, "MAKE_FUNCTION", {HasArgument: true})],
    [133, new OpCode(OpCodes.BUILD_SLICE_A, "BUILD_SLICE", {HasArgument: true})],
    [134, new OpCode(OpCodes.MAKE_CLOSURE_A, "MAKE_CLOSURE", {HasArgument: true})],
    [135, new OpCode(OpCodes.LOAD_CLOSURE_A, "LOAD_CLOSURE", {HasArgument: true, HasFree: true})],
    [136, new OpCode(OpCodes.LOAD_DEREF_A, "LOAD_DEREF", {HasArgument: true, HasFree: true})],
    [137, new OpCode(OpCodes.STORE_DEREF_A, "STORE_DEREF", {HasArgument: true, HasFree: true})],
    [138, new OpCode(OpCodes.DELETE_DEREF_A, "DELETE_DEREF", {HasArgument: true, HasFree: true})],

    [140, new OpCode(OpCodes.CALL_FUNCTION_VAR_A, "CALL_FUNCTION_VAR", {HasArgument: true})],
    [141, new OpCode(OpCodes.CALL_FUNCTION_KW_A, "CALL_FUNCTION_KW", {HasArgument: true})],
    [142, new OpCode(OpCodes.CALL_FUNCTION_VAR_KW_A, "CALL_FUNCTION_VAR_KW", {HasArgument: true})],
    [143, new OpCode(OpCodes.SETUP_WITH_A, "SETUP_WITH", {HasArgument: true, HasJumpRelative: true})],
    [144, new OpCode(OpCodes.EXTENDED_ARG_A, "EXTENDED_ARG", {HasArgument: true})],
    [145, new OpCode(OpCodes.LIST_APPEND_A, "LIST_APPEND", {HasArgument: true})],
    [146, new OpCode(OpCodes.SET_ADD_A, "SET_ADD", {HasArgument: true})],
    [147, new OpCode(OpCodes.MAP_ADD_A, "MAP_ADD", {HasArgument: true})]
];

class Python3_3_OpCodes extends OpCodes {
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

module.exports = Python3_3_OpCodes;
