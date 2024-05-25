const OpCode = require('../OpCode');
const OpCodes = require('../OpCodes');

const opcodes = [
    [1, new OpCode(OpCodes.POP_TOP, "POP_TOP")],
    [2, new OpCode(OpCodes.ROT_TWO, "ROT_TWO")],
    [3, new OpCode(OpCodes.ROT_THREE, "ROT_THREE")],
    [4, new OpCode(OpCodes.DUP_TOP, "DUP_TOP")],
    [5, new OpCode(OpCodes.DUP_TOP_TWO, "DUP_TOP_TWO")],
    [6, new OpCode(OpCodes.ROT_FOUR, "ROT_FOUR")],
    
    [9, new OpCode(OpCodes.NOP, "NOP")],
    [10, new OpCode(OpCodes.UNARY_POSITIVE, "UNARY_POSITIVE")],
    [11, new OpCode(OpCodes.UNARY_NEGATIVE, "UNARY_NEGATIVE")],
    [12, new OpCode(OpCodes.UNARY_NOT, "UNARY_NOT")],
    
    [15, new OpCode(OpCodes.UNARY_INVERT, "UNARY_INVERT")],
    [16, new OpCode(OpCodes.BINARY_MATRIX_MULTIPLY, "BINARY_MATRIX_MULTIPLY")],
    [17, new OpCode(OpCodes.INPLACE_MATRIX_MULTIPLY, "INPLACE_MATRIX_MULTIPLY")],
    
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

    [50, new OpCode(OpCodes.GET_AITER, "GET_AITER")],
    [51, new OpCode(OpCodes.GET_ANEXT, "GET_ANEXT")],
    [52, new OpCode(OpCodes.BEFORE_ASYNC_WITH, "BEFORE_ASYNC_WITH")],
    [53, new OpCode(OpCodes.BEGIN_FINALLY, "BEGIN_FINALLY")],
    [54, new OpCode(OpCodes.END_ASYNC_FOR, "END_ASYNC_FOR")],
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
    [69, new OpCode(OpCodes.GET_YIELD_FROM_ITER, "GET_YIELD_FROM_ITER")],
    [70, new OpCode(OpCodes.PRINT_EXPR, "PRINT_EXPR")],
    [71, new OpCode(OpCodes.LOAD_BUILD_CLASS, "LOAD_BUILD_CLASS")],
    [72, new OpCode(OpCodes.YIELD_FROM, "YIELD_FROM")],
    [73, new OpCode(OpCodes.GET_AWAITABLE, "GET_AWAITABLE")],

    [75, new OpCode(OpCodes.INPLACE_LSHIFT, "INPLACE_LSHIFT")],
    [76, new OpCode(OpCodes.INPLACE_RSHIFT, "INPLACE_RSHIFT")],
    [77, new OpCode(OpCodes.INPLACE_AND, "INPLACE_AND")],
    [78, new OpCode(OpCodes.INPLACE_XOR, "INPLACE_XOR")],
    [79, new OpCode(OpCodes.INPLACE_OR, "INPLACE_OR")],    

    [81, new OpCode(OpCodes.WITH_CLEANUP_START, "WITH_CLEANUP_START")],
    [82, new OpCode(OpCodes.WITH_CLEANUP_FINISH, "WITH_CLEANUP_FINISH")],
    [83, new OpCode(OpCodes.RETURN_VALUE, "RETURN_VALUE")],
    [84, new OpCode(OpCodes.IMPORT_STAR, "IMPORT_STAR")],
    [85, new OpCode(OpCodes.SETUP_ANNOTATIONS, "SETUP_ANNOTATIONS")],
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
    
    [122, new OpCode(OpCodes.SETUP_FINALLY_A, "SETUP_FINALLY", {HasArgument: true, HasJumpRelative: true})],
    
    [124, new OpCode(OpCodes.LOAD_FAST_A, "LOAD_FAST", {HasArgument: true, HasLocal: true})],
    [125, new OpCode(OpCodes.STORE_FAST_A, "STORE_FAST", {HasArgument: true, HasLocal: true})],
    [126, new OpCode(OpCodes.DELETE_FAST_A, "DELETE_FAST", {HasArgument: true, HasLocal: true})],

    [130, new OpCode(OpCodes.RAISE_VARARGS_A, "RAISE_VARARGS", {HasArgument: true})],
    [131, new OpCode(OpCodes.CALL_FUNCTION_A, "CALL_FUNCTION", {HasArgument: true})],
    [132, new OpCode(OpCodes.MAKE_FUNCTION_A, "MAKE_FUNCTION", {HasArgument: true})],
    [133, new OpCode(OpCodes.BUILD_SLICE_A, "BUILD_SLICE", {HasArgument: true})],
    
    [135, new OpCode(OpCodes.LOAD_CLOSURE_A, "LOAD_CLOSURE", {HasArgument: true, HasFree: true})],
    [136, new OpCode(OpCodes.LOAD_DEREF_A, "LOAD_DEREF", {HasArgument: true, HasFree: true})],
    [137, new OpCode(OpCodes.STORE_DEREF_A, "STORE_DEREF", {HasArgument: true, HasFree: true})],
    [138, new OpCode(OpCodes.DELETE_DEREF_A, "DELETE_DEREF", {HasArgument: true, HasFree: true})],

    [141, new OpCode(OpCodes.CALL_FUNCTION_KW_A, "CALL_FUNCTION_KW", {HasArgument: true})],
    [142, new OpCode(OpCodes.CALL_FUNCTION_EX_A, "CALL_FUNCTION_EX", {HasArgument: true})],
    [143, new OpCode(OpCodes.SETUP_WITH_A, "SETUP_WITH", {HasArgument: true, HasJumpRelative: true})],
    [144, new OpCode(OpCodes.EXTENDED_ARG_A, "EXTENDED_ARG", {HasArgument: true})],
    [145, new OpCode(OpCodes.LIST_APPEND_A, "LIST_APPEND", {HasArgument: true})],
    [146, new OpCode(OpCodes.SET_ADD_A, "SET_ADD", {HasArgument: true})],
    [147, new OpCode(OpCodes.MAP_ADD_A, "MAP_ADD", {HasArgument: true})],
    [148, new OpCode(OpCodes.LOAD_CLASSDEREF_A, "LOAD_CLASSDEREF", {HasArgument: true, HasFree: true})],
    [149, new OpCode(OpCodes.BUILD_LIST_UNPACK_A, "BUILD_LIST_UNPACK", {HasArgument: true})],
    [150, new OpCode(OpCodes.BUILD_MAP_UNPACK_A, "BUILD_MAP_UNPACK", {HasArgument: true, HasFree: true})],
    [151, new OpCode(OpCodes.BUILD_MAP_UNPACK_WITH_CALL_A, "BUILD_MAP_UNPACK_WITH_CALL", {HasArgument: true, HasFree: true})],
    [152, new OpCode(OpCodes.BUILD_TUPLE_UNPACK_A, "BUILD_TUPLE_UNPACK", {HasArgument: true})],
    [153, new OpCode(OpCodes.BUILD_SET_UNPACK_A, "BUILD_SET_UNPACK", {HasArgument: true})],
    [154, new OpCode(OpCodes.SETUP_ASYNC_WITH_A, "SETUP_ASYNC_WITH", {HasArgument: true, HasJumpRelative: true})],
    [155, new OpCode(OpCodes.FORMAT_VALUE_A, "FORMAT_VALUE", {HasArgument: true})],
    [156, new OpCode(OpCodes.BUILD_CONST_KEY_MAP_A, "BUILD_CONST_KEY_MAP", {HasArgument: true})],
    [157, new OpCode(OpCodes.BUILD_STRING_A, "BUILD_STRING", {HasArgument: true})],
    [158, new OpCode(OpCodes.BUILD_TUPLE_UNPACK_WITH_CALL_A, "BUILD_TUPLE_UNPACK_WITH_CALL", {HasArgument: true})],

    [160, new OpCode(OpCodes.LOAD_METHOD_A, "LOAD_METHOD", {HasArgument: true, HasName: true})],
    [161, new OpCode(OpCodes.CALL_METHOD_A, "CALL_METHOD", {HasArgument: true})],
    [162, new OpCode(OpCodes.CALL_FINALLY_A, "CALL_FINALLY", {HasArgument: true, HasJumpRelative: true})],
    [163, new OpCode(OpCodes.POP_FINALLY_A, "POP_FINALLY", {HasArgument: true})]
];

class Python3_8_OpCodes extends OpCodes {
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

module.exports = Python3_8_OpCodes;

// BEGIN_MAP(3, 8)
//     MAP_OP(1, POP_TOP)
//     MAP_OP(2, ROT_TWO)
//     MAP_OP(3, ROT_THREE)
//     MAP_OP(4, DUP_TOP)
//     MAP_OP(5, DUP_TOP_TWO)
//     MAP_OP(6, ROT_FOUR)

//     MAP_OP(9, NOP)
//     MAP_OP(10, UNARY_POSITIVE)
//     MAP_OP(11, UNARY_NEGATIVE)
//     MAP_OP(12, UNARY_NOT)

//     MAP_OP(15, UNARY_INVERT)
//     MAP_OP(16, BINARY_MATRIX_MULTIPLY)
//     MAP_OP(17, INPLACE_MATRIX_MULTIPLY)

//     MAP_OP(19, BINARY_POWER)
//     MAP_OP(20, BINARY_MULTIPLY)

//     MAP_OP(22, BINARY_MODULO)
//     MAP_OP(23, BINARY_ADD)
//     MAP_OP(24, BINARY_SUBTRACT)
//     MAP_OP(25, BINARY_SUBSCR)
//     MAP_OP(26, BINARY_FLOOR_DIVIDE)
//     MAP_OP(27, BINARY_TRUE_DIVIDE)
//     MAP_OP(28, INPLACE_FLOOR_DIVIDE)
//     MAP_OP(29, INPLACE_TRUE_DIVIDE)

//     MAP_OP(50, GET_AITER)
//     MAP_OP(51, GET_ANEXT)
//     MAP_OP(52, BEFORE_ASYNC_WITH)
//     MAP_OP(53, BEGIN_FINALLY)
//     MAP_OP(54, END_ASYNC_FOR)
//     MAP_OP(55, INPLACE_ADD)
//     MAP_OP(56, INPLACE_SUBTRACT)
//     MAP_OP(57, INPLACE_MULTIPLY)

//     MAP_OP(59, INPLACE_MODULO)
//     MAP_OP(60, STORE_SUBSCR)
//     MAP_OP(61, DELETE_SUBSCR)
//     MAP_OP(62, BINARY_LSHIFT)
//     MAP_OP(63, BINARY_RSHIFT)
//     MAP_OP(64, BINARY_AND)
//     MAP_OP(65, BINARY_XOR)
//     MAP_OP(66, BINARY_OR)
//     MAP_OP(67, INPLACE_POWER)
//     MAP_OP(68, GET_ITER)
//     MAP_OP(69, GET_YIELD_FROM_ITER)
//     MAP_OP(70, PRINT_EXPR)
//     MAP_OP(71, LOAD_BUILD_CLASS)
//     MAP_OP(72, YIELD_FROM)
//     MAP_OP(73, GET_AWAITABLE)

//     MAP_OP(75, INPLACE_LSHIFT)
//     MAP_OP(76, INPLACE_RSHIFT)
//     MAP_OP(77, INPLACE_AND)
//     MAP_OP(78, INPLACE_XOR)
//     MAP_OP(79, INPLACE_OR)

//     MAP_OP(81, WITH_CLEANUP_START)
//     MAP_OP(82, WITH_CLEANUP_FINISH)
//     MAP_OP(83, RETURN_VALUE)
//     MAP_OP(84, IMPORT_STAR)
//     MAP_OP(85, SETUP_ANNOTATIONS)
//     MAP_OP(86, YIELD_VALUE)
//     MAP_OP(87, POP_BLOCK)
//     MAP_OP(88, END_FINALLY)
//     MAP_OP(89, POP_EXCEPT)
//     MAP_OP(90, STORE_NAME_A)
//     MAP_OP(91, DELETE_NAME_A)
//     MAP_OP(92, UNPACK_SEQUENCE_A)
//     MAP_OP(93, FOR_ITER_A)
//     MAP_OP(94, UNPACK_EX_A)
//     MAP_OP(95, STORE_ATTR_A)
//     MAP_OP(96, DELETE_ATTR_A)
//     MAP_OP(97, STORE_GLOBAL_A)
//     MAP_OP(98, DELETE_GLOBAL_A)

//     MAP_OP(100, LOAD_CONST_A)
//     MAP_OP(101, LOAD_NAME_A)
//     MAP_OP(102, BUILD_TUPLE_A)
//     MAP_OP(103, BUILD_LIST_A)
//     MAP_OP(104, BUILD_SET_A)
//     MAP_OP(105, BUILD_MAP_A)
//     MAP_OP(106, LOAD_ATTR_A)
//     MAP_OP(107, COMPARE_OP_A)
//     MAP_OP(108, IMPORT_NAME_A)
//     MAP_OP(109, IMPORT_FROM_A)
//     MAP_OP(110, JUMP_FORWARD_A)
//     MAP_OP(111, JUMP_IF_FALSE_OR_POP_A)
//     MAP_OP(112, JUMP_IF_TRUE_OR_POP_A)
//     MAP_OP(113, JUMP_ABSOLUTE_A)
//     MAP_OP(114, POP_JUMP_IF_FALSE_A)
//     MAP_OP(115, POP_JUMP_IF_TRUE_A)
//     MAP_OP(116, LOAD_GLOBAL_A)

//     MAP_OP(122, SETUP_FINALLY_A)
    
//     MAP_OP(124, LOAD_FAST_A)
//     MAP_OP(125, STORE_FAST_A)
//     MAP_OP(126, DELETE_FAST_A)

//     MAP_OP(130, RAISE_VARARGS_A)
//     MAP_OP(131, CALL_FUNCTION_A)
//     MAP_OP(132, MAKE_FUNCTION_A)
//     MAP_OP(133, BUILD_SLICE_A)
    
//     MAP_OP(135, LOAD_CLOSURE_A)
//     MAP_OP(136, LOAD_DEREF_A)
//     MAP_OP(137, STORE_DEREF_A)
//     MAP_OP(138, DELETE_DEREF_A)
    
//     MAP_OP(141, CALL_FUNCTION_KW_A)
//     MAP_OP(142, CALL_FUNCTION_EX_A)
//     MAP_OP(143, SETUP_WITH_A)
//     MAP_OP(144, EXTENDED_ARG_A)
//     MAP_OP(145, LIST_APPEND_A)
//     MAP_OP(146, SET_ADD_A)
//     MAP_OP(147, MAP_ADD_A)
//     MAP_OP(148, LOAD_CLASSDEREF_A)
//     MAP_OP(149, BUILD_LIST_UNPACK_A)
//     MAP_OP(150, BUILD_MAP_UNPACK_A)
//     MAP_OP(151, BUILD_MAP_UNPACK_WITH_CALL_A)
//     MAP_OP(152, BUILD_TUPLE_UNPACK_A)
//     MAP_OP(153, BUILD_SET_UNPACK_A)
//     MAP_OP(154, SETUP_ASYNC_WITH_A)
//     MAP_OP(155, FORMAT_VALUE_A)
//     MAP_OP(156, BUILD_CONST_KEY_MAP_A)
//     MAP_OP(157, BUILD_STRING_A)
//     MAP_OP(158, BUILD_TUPLE_UNPACK_WITH_CALL_A)

//     MAP_OP(160, LOAD_METHOD_A)
//     MAP_OP(161, CALL_METHOD_A)
//     MAP_OP(162, CALL_FINALLY_A)
//     MAP_OP(163, POP_FINALLY_A)
// END_MAP()
