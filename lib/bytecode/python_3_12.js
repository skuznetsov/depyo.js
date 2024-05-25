const OpCode = require('../OpCode');
const OpCodes = require('../OpCodes');

const opcodes = [
    [0, new OpCode(OpCodes.CACHE, "CACHE")],
    [1, new OpCode(OpCodes.POP_TOP, "POP_TOP")],
    [2, new OpCode(OpCodes.PUSH_NULL, "PUSH_NULL")],
    [3, new OpCode(OpCodes.INTERPRETER_EXIT, "INTERPRETER_EXIT")],
    [4, new OpCode(OpCodes.END_FOR, "END_FOR")],
    [5, new OpCode(OpCodes.END_SEND, "END_SEND")],

    [9, new OpCode(OpCodes.NOP, "NOP")],

    [11, new OpCode(OpCodes.UNARY_NEGATIVE, "UNARY_NEGATIVE")],
    [12, new OpCode(OpCodes.UNARY_NOT, "UNARY_NOT")],
    
    [15, new OpCode(OpCodes.UNARY_INVERT, "UNARY_INVERT")],

    [17, new OpCode(OpCodes.RESERVED, "RESERVED")],

    [25, new OpCode(OpCodes.BINARY_SUBSCR, "BINARY_SUBSCR")],
    [26, new OpCode(OpCodes.BINARY_SLICE, "BINARY_SLICE")],
    [27, new OpCode(OpCodes.STORE_SLICE, "STORE_SLICE")],

    [30, new OpCode(OpCodes.GET_LEN, "GET_LEN")],
    [31, new OpCode(OpCodes.MATCH_MAPPING, "MATCH_MAPPING")],
    [32, new OpCode(OpCodes.MATCH_SEQUENCE, "MATCH_SEQUENCE")],
    [33, new OpCode(OpCodes.MATCH_KEYS, "MATCH_KEYS")],

    [35, new OpCode(OpCodes.PUSH_EXC_INFO, "PUSH_EXC_INFO")],
    [36, new OpCode(OpCodes.CHECK_EXC_MATCH, "CHECK_EXC_MATCH")],
    [37, new OpCode(OpCodes.CHECK_EG_MATCH, "CHECK_EG_MATCH")],

    [49, new OpCode(OpCodes.WITH_EXCEPT_START, "WITH_EXCEPT_START")],
    [50, new OpCode(OpCodes.GET_AITER, "GET_AITER")],
    [51, new OpCode(OpCodes.GET_ANEXT, "GET_ANEXT")],
    [52, new OpCode(OpCodes.BEFORE_ASYNC_WITH, "BEFORE_ASYNC_WITH")],
    [53, new OpCode(OpCodes.BEFORE_WITH, "BEFORE_WITH")],
    [54, new OpCode(OpCodes.END_ASYNC_FOR, "END_ASYNC_FOR")],
    [55, new OpCode(OpCodes.CLEANUP_THROW, "CLEANUP_THROW")],

    [60, new OpCode(OpCodes.STORE_SUBSCR, "STORE_SUBSCR")],
    [61, new OpCode(OpCodes.DELETE_SUBSCR, "DELETE_SUBSCR")],

    [68, new OpCode(OpCodes.GET_ITER, "GET_ITER")],
    [69, new OpCode(OpCodes.GET_YIELD_FROM_ITER, "GET_YIELD_FROM_ITER")],
    [70, new OpCode(OpCodes.PRINT_EXPR, "PRINT_EXPR")],
    [71, new OpCode(OpCodes.LOAD_BUILD_CLASS, "LOAD_BUILD_CLASS")],

    [74, new OpCode(OpCodes.LOAD_ASSERTION_ERROR, "LOAD_ASSERTION_ERROR")],
    [75, new OpCode(OpCodes.RETURN_GENERATOR, "RETURN_GENERATOR")],

    [83, new OpCode(OpCodes.RETURN_VALUE, "RETURN_VALUE")],
    
    [85, new OpCode(OpCodes.SETUP_ANNOTATIONS, "SETUP_ANNOTATIONS")],

    [87, new OpCode(OpCodes.LOAD_LOCALS, "LOAD_LOCALS")],
    
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
    [99, new OpCode(OpCodes.SWAP_A, "SWAP_A", {HasArgument: true})],
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
    
    [114, new OpCode(OpCodes.POP_JUMP_FORWARD_IF_FALSE_A, "POP_JUMP_FORWARD_IF_FALSE", {HasArgument: true, HasJumpRelative: true})],
    [115, new OpCode(OpCodes.POP_JUMP_FORWARD_IF_TRUE_A, "POP_JUMP_FORWARD_IF_TRUE", {HasArgument: true, HasJumpRelative: true})],
    [116, new OpCode(OpCodes.LOAD_GLOBAL_A, "LOAD_GLOBAL", {HasArgument: true, HasName: true})],
    [117, new OpCode(OpCodes.IS_OP_A, "IS_OP", {HasArgument: true})],
    [118, new OpCode(OpCodes.CONTAINS_OP_A, "CONTAINS_OP", {HasArgument: true})],
    [119, new OpCode(OpCodes.RERAISE_A, "RERAISE", {HasArgument: true})],
    [120, new OpCode(OpCodes.COPY_A, "COPY", {HasArgument: true})],
    [121, new OpCode(OpCodes.RETURN_CONST_A, "RETURN_CONST", {HasArgument: true})],
    [122, new OpCode(OpCodes.BINARY_OP_A, "BINARY_OP", {HasArgument: true, HasBinaryOp: true})],
    [123, new OpCode(OpCodes.SEND_A, "SEND", {HasArgument: true, HasJumpRelative: true})],
    [124, new OpCode(OpCodes.LOAD_FAST_A, "LOAD_FAST", {HasArgument: true, HasLocal: true})],
    [125, new OpCode(OpCodes.STORE_FAST_A, "STORE_FAST", {HasArgument: true, HasLocal: true})],
    [126, new OpCode(OpCodes.DELETE_FAST_A, "DELETE_FAST", {HasArgument: true, HasLocal: true})],
    [127, new OpCode(OpCodes.LOAD_FAST_CHECK_A, "LOAD_FAST_CHECK", {HasArgument: true, HasLocal: true})],
    [128, new OpCode(OpCodes.POP_JUMP_FORWARD_IF_NOT_NONE_A, "POP_JUMP_FORWARD_IF_NOT_NONE", {HasArgument: true, HasJumpRelative: true})],
    [129, new OpCode(OpCodes.POP_JUMP_FORWARD_IF_NONE_A, "POP_JUMP_FORWARD_IF_NONE", {HasArgument: true, HasJumpRelative: true})],
    [130, new OpCode(OpCodes.RAISE_VARARGS_A, "RAISE_VARARGS", {HasArgument: true})],
    [131, new OpCode(OpCodes.GET_AWAITABLE_A, "GET_AWAITABLE", {HasArgument: true})],
    [132, new OpCode(OpCodes.MAKE_FUNCTION_A, "MAKE_FUNCTION", {HasArgument: true})],
    [133, new OpCode(OpCodes.BUILD_SLICE_A, "BUILD_SLICE", {HasArgument: true})],
    [129, new OpCode(OpCodes.JUMP_BACKWARD_NO_INTERRUPT_A, "JUMP_BACKWARD_NO_INTERRUPT", {HasArgument: true, HasJumpRelative: true, HasNegativeOffset: true})],
    [135, new OpCode(OpCodes.MAKE_CELL_A, "MAKE_CELL", {HasArgument: true, HasFree: true})],
    [136, new OpCode(OpCodes.LOAD_CLOSURE_A, "LOAD_CLOSURE", {HasArgument: true, HasFree: true})],
    [137, new OpCode(OpCodes.LOAD_DEREF_A, "LOAD_DEREF", {HasArgument: true, HasFree: true})],
    [138, new OpCode(OpCodes.STORE_DEREF_A, "STORE_DEREF", {HasArgument: true, HasFree: true})],
    [139, new OpCode(OpCodes.DELETE_DEREF_A, "DELETE_DEREF", {HasArgument: true, HasFree: true})],
    [140, new OpCode(OpCodes.JUMP_BACKWARD_A, "JUMP_BACKWARD", {HasArgument: true, HasJumpRelative: true, HasNegativeOffset: true})],
    [141, new OpCode(OpCodes.LOAD_SUPER_ATTR_A, "LOAD_SUPER_ATTR", {HasArgument: true, HasName: true, HasFlags: true})],
    [142, new OpCode(OpCodes.CALL_FUNCTION_EX_A, "CALL_FUNCTION_EX", {HasArgument: true})],
    [143, new OpCode(OpCodes.LOAD_FAST_AND_CLEAR_A, "LOAD_FAST_AND_CLEAR", {HasArgument: true, HasLocal: true})],
    [144, new OpCode(OpCodes.EXTENDED_ARG_A, "EXTENDED_ARG", {HasArgument: true})],
    [145, new OpCode(OpCodes.LIST_APPEND_A, "LIST_APPEND", {HasArgument: true})],
    [146, new OpCode(OpCodes.SET_ADD_A, "SET_ADD", {HasArgument: true})],
    [147, new OpCode(OpCodes.MAP_ADD_A, "MAP_ADD", {HasArgument: true})],
    
    [149, new OpCode(OpCodes.COPY_FREE_VARS_A, "COPY_FREE_VARS", {HasArgument: true})],
    [150, new OpCode(OpCodes.YIELD_VALUE_A, "YIELD_VALUE", {HasArgument: true})],
    [151, new OpCode(OpCodes.RESUME_A, "RESUME", {HasArgument: true})],
    [152, new OpCode(OpCodes.MATCH_CLASS_A, "MATCH_CLASS", {HasArgument: true})],

    [155, new OpCode(OpCodes.FORMAT_VALUE_A, "FORMAT_VALUE", {HasArgument: true})],
    [156, new OpCode(OpCodes.BUILD_CONST_KEY_MAP_A, "BUILD_CONST_KEY_MAP", {HasArgument: true})],
    [157, new OpCode(OpCodes.BUILD_STRING_A, "BUILD_STRING", {HasArgument: true})],

    [162, new OpCode(OpCodes.LIST_EXTEND_A, "LIST_EXTEND", {HasArgument: true})],
    [163, new OpCode(OpCodes.SET_UPDATE_A, "SET_UPDATE", {HasArgument: true})],
    [164, new OpCode(OpCodes.DICT_MERGE_A, "DICT_MERGE", {HasArgument: true})],
    [165, new OpCode(OpCodes.DICT_UPDATE_A, "DICT_UPDATE", {HasArgument: true})],
    
    [171, new OpCode(OpCodes.CALL_A, "CALL", {HasArgument: true})],
    [172, new OpCode(OpCodes.KW_NAMES_A, "KW_NAMES", {HasArgument: true, HasConstant: true})],
    [173, new OpCode(OpCodes.CALL_INTRINSIC_1_A, "CALL_INTRINSIC_1", {HasArgument: true, HasIntrisic1: true})],
    [174, new OpCode(OpCodes.CALL_INTRINSIC_2_A, "CALL_INTRINSIC_2", {HasArgument: true, HasIntrisic2: true})],
    [175, new OpCode(OpCodes.LOAD_FROM_DICT_OR_GLOBALS_A, "LOAD_FROM_DICT_OR_GLOBALS", {HasArgument: true, HasName: true})],
    [176, new OpCode(OpCodes.LOAD_FROM_DICT_OR_DEREF_A, "LOAD_FROM_DICT_OR_DEREF", {HasArgument: true, HasName: true, HasLocal: true})],

    [237, new OpCode(OpCodes.INSTRUMENTED_LOAD_SUPER_ATTR_A, "INSTRUMENTED_LOAD_SUPER_ATTR", {HasArgument: true, HasName: true, HasFlags: true})],
    [238, new OpCode(OpCodes.INSTRUMENTED_POP_JUMP_IF_NONE_A, "INSTRUMENTED_POP_JUMP_IF_NONE", {HasArgument: true, HasJumpRelative: true})],
    [239, new OpCode(OpCodes.INSTRUMENTED_POP_JUMP_IF_NOT_NONE_A, "INSTRUMENTED_POP_JUMP_IF_NOT_NONE_A", {HasArgument: true, HasJumpRelative: true})],
    [240, new OpCode(OpCodes.INSTRUMENTED_RESUME_A, "INSTRUMENTED_RESUME_A", {HasArgument: true})],
    [241, new OpCode(OpCodes.INSTRUMENTED_CALL_A, "INSTRUMENTED_CALL", {HasArgument: true})],
    [242, new OpCode(OpCodes.INSTRUMENTED_RETURN_VALUE_A, "INSTRUMENTED_RETURN_VALUE", {HasArgument: true})],
    [243, new OpCode(OpCodes.INSTRUMENTED_YIELD_VALUE_A, "INSTRUMENTED_YIELD_VALUE", {HasArgument: true})],
    [244, new OpCode(OpCodes.INSTRUMENTED_CALL_FUNCTION_EX_A, "INSTRUMENTED_CALL_FUNCTION_EX", {HasArgument: true})],
    [245, new OpCode(OpCodes.INSTRUMENTED_JUMP_FORWARD_A, "INSTRUMENTED_JUMP_FORWARD", {HasArgument: true, HasJumpRelative: true})],
    [246, new OpCode(OpCodes.INSTRUMENTED_JUMP_BACKWARD_A, "INSTRUMENTED_JUMP_BACKWARD", {HasArgument: true, HasJumpRelative: true, HasNegativeOffset: true})],
    [247, new OpCode(OpCodes.INSTRUMENTED_RETURN_CONST_A, "INSTRUMENTED_RETURN_CONST", {HasArgument: true, HasConstant: true})],
    [248, new OpCode(OpCodes.INSTRUMENTED_FOR_ITER_A, "INSTRUMENTED_FOR_ITER", {HasArgument: true, HasJumpRelative: true})],
    [249, new OpCode(OpCodes.INSTRUMENTED_POP_JUMP_IF_FALSE_A, "INSTRUMENTED_POP_JUMP_IF_FALSE", {HasArgument: true, HasJumpRelative: true})],
    [250, new OpCode(OpCodes.INSTRUMENTED_POP_JUMP_IF_TRUE_A, "INSTRUMENTED_POP_JUMP_IF_TRUE", {HasArgument: true, HasJumpRelative: true})],
    [251, new OpCode(OpCodes.INSTRUMENTED_END_FOR_A, "INSTRUMENTED_END_FOR", {HasArgument: true})],
    [252, new OpCode(OpCodes.INSTRUMENTED_END_SEND_A, "INSTRUMENTED_END_SEND", {HasArgument: true})],
    [253, new OpCode(OpCodes.INSTRUMENTED_INSTRUCTION_A, "INSTRUMENTED_INSTRUCTION", {HasArgument: true})],
    [254, new OpCode(OpCodes.INSTRUMENTED_LINE_A, "INSTRUMENTED_LINE", {HasArgument: true})]
];

class Python3_12_OpCodes extends OpCodes {
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

module.exports = Python3_12_OpCodes;

// BEGIN_MAP(3, 12)
//     MAP_OP(0, CACHE)
//     MAP_OP(1, POP_TOP)
//     MAP_OP(2, PUSH_NULL)
//     MAP_OP(3, INTERPRETER_EXIT)
//     MAP_OP(4, END_FOR)
//     MAP_OP(5, END_SEND)

//     MAP_OP(9, NOP)

//     MAP_OP(11, UNARY_NEGATIVE)
//     MAP_OP(12, UNARY_NOT)

//     MAP_OP(15, UNARY_INVERT)

//     MAP_OP(17, RESERVED)

//     MAP_OP(25, BINARY_SUBSCR)
//     MAP_OP(26, BINARY_SLICE)
//     MAP_OP(27, STORE_SLICE)

//     MAP_OP(30, GET_LEN)
//     MAP_OP(31, MATCH_MAPPING)
//     MAP_OP(32, MATCH_SEQUENCE)
//     MAP_OP(33, MATCH_KEYS)

//     MAP_OP(35, PUSH_EXC_INFO)
//     MAP_OP(36, CHECK_EXC_MATCH)
//     MAP_OP(37, CHECK_EG_MATCH)
    
//     MAP_OP(49, WITH_EXCEPT_START)
//     MAP_OP(50, GET_AITER)
//     MAP_OP(51, GET_ANEXT)
//     MAP_OP(52, BEFORE_ASYNC_WITH)
//     MAP_OP(53, BEFORE_WITH)
//     MAP_OP(54, END_ASYNC_FOR)
//     MAP_OP(55, CLEANUP_THROW)

//     MAP_OP(60, STORE_SUBSCR)
//     MAP_OP(61, DELETE_SUBSCR)

//     MAP_OP(68, GET_ITER)
//     MAP_OP(69, GET_YIELD_FROM_ITER)

//     MAP_OP(71, LOAD_BUILD_CLASS)
    
//     MAP_OP(74, LOAD_ASSERTION_ERROR)
//     MAP_OP(75, RETURN_GENERATOR)

//     MAP_OP(83, RETURN_VALUE)

//     MAP_OP(85, SETUP_ANNOTATIONS)

//     MAP_OP(87, LOAD_LOCALS)

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
//     MAP_OP(99, SWAP_A)
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
    
//     MAP_OP(114, POP_JUMP_IF_FALSE_A)
//     MAP_OP(115, POP_JUMP_IF_TRUE_A)
//     MAP_OP(116, LOAD_GLOBAL_A)
//     MAP_OP(117, IS_OP_A)
//     MAP_OP(118, CONTAINS_OP_A)
//     MAP_OP(119, RERAISE_A)
//     MAP_OP(120, COPY_A)
//     MAP_OP(121, RETURN_CONST_A)
//     MAP_OP(122, BINARY_OP_A)
//     MAP_OP(123, SEND_A)
//     MAP_OP(124, LOAD_FAST_A)
//     MAP_OP(125, STORE_FAST_A)
//     MAP_OP(126, DELETE_FAST_A)
//     MAP_OP(127, LOAD_FAST_CHECK_A)
//     MAP_OP(128, POP_JUMP_IF_NOT_NONE_A)
//     MAP_OP(129, POP_JUMP_IF_NONE_A)
//     MAP_OP(130, RAISE_VARARGS_A)
//     MAP_OP(131, GET_AWAITABLE_A)
//     MAP_OP(132, MAKE_FUNCTION_A)
//     MAP_OP(133, BUILD_SLICE_A)
//     MAP_OP(134, JUMP_BACKWARD_NO_INTERRUPT_A)
//     MAP_OP(135, MAKE_CELL_A)
//     MAP_OP(136, LOAD_CLOSURE_A)
//     MAP_OP(137, LOAD_DEREF_A)
//     MAP_OP(138, STORE_DEREF_A)
//     MAP_OP(139, DELETE_DEREF_A)
//     MAP_OP(140, JUMP_BACKWARD_A)
//     MAP_OP(141, LOAD_SUPER_ATTR_A)
//     MAP_OP(142, CALL_FUNCTION_EX_A)
//     MAP_OP(143, LOAD_FAST_AND_CLEAR_A)
//     MAP_OP(144, EXTENDED_ARG_A)
//     MAP_OP(145, LIST_APPEND_A)
//     MAP_OP(146, SET_ADD_A)
//     MAP_OP(147, MAP_ADD_A)

//     MAP_OP(149, COPY_FREE_VARS_A)
//     MAP_OP(150, YIELD_VALUE_A)
//     MAP_OP(151, RESUME_A)
//     MAP_OP(152, MATCH_CLASS_A)

//     MAP_OP(155, FORMAT_VALUE_A)
//     MAP_OP(156, BUILD_CONST_KEY_MAP_A)
//     MAP_OP(157, BUILD_STRING_A)

//     MAP_OP(162, LIST_EXTEND_A)
//     MAP_OP(163, SET_UPDATE_A)
//     MAP_OP(164, DICT_MERGE_A)
//     MAP_OP(165, DICT_UPDATE_A)

//     MAP_OP(171, CALL_A)
//     MAP_OP(172, KW_NAMES_A)
//     MAP_OP(173, CALL_INTRINSIC_1_A)
//     MAP_OP(174, CALL_INTRINSIC_2_A)
//     MAP_OP(175, LOAD_FROM_DICT_OR_GLOBALS_A)
//     MAP_OP(176, LOAD_FROM_DICT_OR_DEREF_A)
    
//     MAP_OP(237, INSTRUMENTED_LOAD_SUPER_ATTR_A)
//     MAP_OP(238, INSTRUMENTED_POP_JUMP_IF_NONE_A)
//     MAP_OP(239, INSTRUMENTED_POP_JUMP_IF_NOT_NONE_A)
//     MAP_OP(240, INSTRUMENTED_RESUME_A)
//     MAP_OP(241, INSTRUMENTED_CALL_A)
//     MAP_OP(242, INSTRUMENTED_RETURN_VALUE_A)
//     MAP_OP(243, INSTRUMENTED_YIELD_VALUE_A)
//     MAP_OP(244, INSTRUMENTED_CALL_FUNCTION_EX_A)
//     MAP_OP(245, INSTRUMENTED_JUMP_FORWARD_A)
//     MAP_OP(246, INSTRUMENTED_JUMP_BACKWARD_A)
//     MAP_OP(247, INSTRUMENTED_RETURN_CONST_A)
//     MAP_OP(248, INSTRUMENTED_FOR_ITER_A)
//     MAP_OP(249, INSTRUMENTED_POP_JUMP_IF_FALSE_A)
//     MAP_OP(250, INSTRUMENTED_POP_JUMP_IF_TRUE_A)
//     MAP_OP(251, INSTRUMENTED_END_FOR_A)
//     MAP_OP(252, INSTRUMENTED_END_SEND_A)
//     MAP_OP(253, INSTRUMENTED_INSTRUCTION_A)
//     MAP_OP(254, INSTRUMENTED_LINE_A)
// END_MAP()
