const OpCode = require('./OpCode');

class OpCodes
{

    /* No parameter word */
    static STOP_CODE = 0;                       // Python 1.0 - 3.2
    static POP_TOP = 1;                         // Python 1.0 ->
    static ROT_TWO = 2;                         // Python 1.0 - 3.10
    static ROT_THREE = 3;                       // Python 1.0 - 3.10
    static DUP_TOP = 4;                         // Python 1.0 - 3.10
    static DUP_TOP_TWO = 5;                     // Python 3.2 - 3.10
    static UNARY_POSITIVE = 6;                  // Python 1.0 - 3.11
    static UNARY_NEGATIVE = 7;                  // Python 1.0 ->
    static UNARY_NOT = 8;                       // Python 1.0 ->
    static UNARY_CONVERT = 9;                   // Python 1.0 - 2.7
    static UNARY_CALL = 10;                      // Python 1.0 - 1.2
    static UNARY_INVERT = 11;                   // Python 1.0 ->
    static BINARY_POWER = 12;                   // Python 1.4 - 3.10
    static BINARY_MULTIPLY = 13;                // Python 1.0 - 3.10
    static BINARY_DIVIDE = 14;                  // Python 1.0 - 2.7
    static BINARY_MODULO = 15;                  // Python 1.0 - 3.10
    static BINARY_ADD = 16;                     // Python 1.0 - 3.10
    static BINARY_SUBTRACT = 17;                // Python 1.0 - 3.10
    static BINARY_SUBSCR = 18;                  // Python 1.0 ->
    static BINARY_CALL = 19;                    // Python 1.0 - 1.2
    static SLICE_0 = 20;                        // Python 1.0 - 2.7
    static SLICE_1 = 21;                        // Python 1.0 - 2.7
    static SLICE_2 = 22;                        // Python 1.0 - 2.7
    static SLICE_3 = 23;                        // Python 1.0 - 2.7
    static STORE_SLICE_0 = 24;                  // Python 1.0 - 2.7
    static STORE_SLICE_1 = 25;                  // Python 1.0 - 2.7
    static STORE_SLICE_2 = 26;                  // Python 1.0 - 2.7
    static STORE_SLICE_3 = 27;                  // Python 1.0 - 2.7
    static DELETE_SLICE_0 = 28;                 // Python 1.0 - 2.7
    static DELETE_SLICE_1 = 29;                 // Python 1.0 - 2.7
    static DELETE_SLICE_2 = 30;                 // Python 1.0 - 2.7
    static DELETE_SLICE_3 = 31;                 // Python 1.0 - 2.7
    static STORE_SUBSCR = 32;                   // Python 1.0 ->
    static DELETE_SUBSCR = 33;                  // Python 1.0 ->
    static BINARY_LSHIFT = 34;                  // Python 1.0 - 3.10
    static BINARY_RSHIFT = 35;                  // Python 1.0 - 3.10
    static BINARY_AND = 36;                     // Python 1.0 - 3.10
    static BINARY_XOR = 37;                     // Python 1.0 - 3.10
    static BINARY_OR = 38;                      // Python 1.0 - 3.10
    static PRINT_EXPR = 39;                     // Python 1.0 - 3.11
    static PRINT_ITEM = 40;                     // Python 1.0 - 2.7
    static PRINT_NEWLINE = 41;                  // Python 1.0 - 2.7
    static BREAK_LOOP = 42;                     // Python 1.0 - 3.7
    static RAISE_EXCEPTION = 43;                // Python 1.0 - 1.2
    static LOAD_LOCALS = 44;                    // Python 1.0 - 2.7, 3.12 ->
    static RETURN_VALUE = 45;                   // Python 1.0 ->
    static LOAD_GLOBALS = 46;                   // Python 1.0 - 1.2
    static EXEC_STMT = 47;                      // Python 1.0 - 2.7
    static BUILD_FUNCTION = 48;                 // Python 1.0 - 1.2
    static POP_BLOCK = 49;                      // Python 1.0 - 3.10
    static END_FINALLY = 50;                    // Python 1.0 - 3.8
    static BUILD_CLASS = 51;                    // Python 1.0 - 2.7
    static ROT_FOUR = 52;                       // Python 2.0 - 3.1, 3.8 - 3.10
    static NOP = 53;                            // Python 2.4 ->
    static LIST_APPEND = 54;                    // Python 2.4 - 2.6, 3.0
    static BINARY_FLOOR_DIVIDE = 55;            // Python 2.2 - 3.10
    static BINARY_TRUE_DIVIDE = 56;             // Python 2.2 - 3.10
    static INPLACE_FLOOR_DIVIDE = 57;           // Python 2.2 - 3.10
    static INPLACE_TRUE_DIVIDE = 58;            // Python 2.2 - 3.10
    static GET_LEN = 59;                        // Python 3.10 ->
    static MATCH_MAPPING = 60;                  // Python 3.10 ->
    static MATCH_SEQUENCE = 61;                 // Python 3.10 ->
    static MATCH_KEYS = 62;                     // Python 3.10 ->
    static COPY_DICT_WITHOUT_KEYS = 63;         // Python 3.10
    static STORE_MAP = 64;                      // Python 2.6 - 3.4
    static INPLACE_ADD = 65;                    // Python 2.0 - 3.10
    static INPLACE_SUBTRACT = 66;               // Python 2.0 - 3.10
    static INPLACE_MULTIPLY = 67;               // Python 2.0 - 3.10
    static INPLACE_DIVIDE = 68;                 // Python 2.0 - 2.7
    static INPLACE_MODULO = 69;                 // Python 2.0 - 3.10
    static INPLACE_POWER = 70;                  // Python 2.0 - 3.10
    static GET_ITER = 71;                       // Python 2.2 ->
    static PRINT_ITEM_TO = 72;                  // Python 2.0 - 2.7
    static PRINT_NEWLINE_TO = 73;               // Python 2.0 - 2.7
    static INPLACE_LSHIFT = 74;                 // Python 2.0 - 3.10
    static INPLACE_RSHIFT = 75;                 // Python 2.0 - 3.10
    static INPLACE_AND = 76;                    // Python 2.0 - 3.10
    static INPLACE_XOR = 77;                    // Python 2.0 - 3.10
    static INPLACE_OR = 78;                     // Python 2.0 - 3.10
    static WITH_CLEANUP = 79;                   // Python 2.5 - 3.4
    static WITH_CLEANUP_START = 80;             // Python 3.5 - 3.8
    static WITH_CLEANUP_FINISH = 81;            // Python 3.5 - 3.8
    static IMPORT_STAR = 82;                    // Python 2.0 - 3.11
    static SETUP_ANNOTATIONS = 83;              // Python 3.6 ->
    static YIELD_VALUE = 84;                    // Python 2.2 - 3.11
    static LOAD_BUILD_CLASS = 85;               // Python 3.0 ->
    static STORE_LOCALS = 86;                   // Python 3.0 - 3.3
    static POP_EXCEPT = 87;                     // Python 3.0 ->
    static SET_ADD = 88;                        // Python 3.0
    static YIELD_FROM = 89;                     // Python 3.3 - 3.10
    static BINARY_MATRIX_MULTIPLY = 90;         // Python 3.5 - 3.10
    static INPLACE_MATRIX_MULTIPLY = 91;        // Python 3.5 - 3.10
    static GET_AITER = 92;                      // Python 3.5 ->
    static GET_ANEXT = 93;                      // Python 3.5 ->
    static BEFORE_ASYNC_WITH = 94;              // Python 3.5 ->
    static GET_YIELD_FROM_ITER = 95;            // Python 3.5 ->
    static GET_AWAITABLE = 96;                  // Python 3.5 - 3.10
    static BEGIN_FINALLY = 97;                  // Python 3.8
    static END_ASYNC_FOR = 98;                  // Python 3.8 ->
    static RERAISE = 99;                        // Python 3.9
    static WITH_EXCEPT_START = 100;              // Python 3.9 ->
    static LOAD_ASSERTION_ERROR = 101;          // Python 3.9 ->
    static LIST_TO_TUPLE = 102;                 // Python 3.9 - 3.11
    static CACHE = 103;                         // Python 3.11 ->
    static PUSH_NULL = 104;                     // Python 3.11 ->
    static PUSH_EXC_INFO = 105;                 // Python 3.11 ->
    static CHECK_EXC_MATCH = 106;               // Python 3.11 ->
    static CHECK_EG_MATCH = 107;                // Python 3.11 ->
    static BEFORE_WITH = 108;                   // Python 3.11 ->
    static RETURN_GENERATOR = 109;              // Python 3.11 ->
    static ASYNC_GEN_WRAP = 110;                // Python 3.11
    static PREP_RERAISE_STAR = 111;             // Python 3.11
    static INTERPRETER_EXIT = 112;              // Python 3.12 ->
    static END_FOR = 113;                       // Python 3.12 ->
    static END_SEND = 114;                      // Python 3.12 ->
    static RESERVED = 115;                      // Python 3.12 ->
    static BINARY_SLICE = 116;                  // Python 3.12 ->
    static STORE_SLICE = 117;                   // Python 3.12 ->
    static CLEANUP_THROW = 118;                 // Python 3.12 ->

    /* Has parameter word */
    static PYC_HAVE_ARG = 119;
    static STORE_NAME_A = OpCodes.PYC_HAVE_ARG;        // Python 1.0 ->                names[A]
    static DELETE_NAME_A = 120;                // Python 1.0 ->                names[A]
    static UNPACK_TUPLE_A = 121;               // Python 1.0 - 1.6             A=count
    static UNPACK_LIST_A = 122;                // Python 1.0 - 1.6             A=count
    static UNPACK_ARG_A = 123;                 // Python 1.0 - 1.4             A=count
    static STORE_ATTR_A = 124;                 // Python 1.0 ->                names[A]
    static DELETE_ATTR_A = 125;                // Python 1.0 ->                names[A]
    static STORE_GLOBAL_A = 126;               // Python 1.0 ->                names[A]
    static DELETE_GLOBAL_A = 127;              // Python 1.0 ->                names[A]
    static ROT_N_A = 128;                      // Python 3.10                  A=count
    static UNPACK_VARARG_A = 129;              // Python 1.0 - 1.4             A=count
    static LOAD_CONST_A = 130;                 // Python 1.0 ->                consts[A]
    static LOAD_NAME_A = 131;                  // Python 1.0 ->                names[A]
    static BUILD_TUPLE_A = 132;                // Python 1.0 ->                A=size
    static BUILD_LIST_A = 133;                 // Python 1.0 ->                A=size
    static BUILD_MAP_A = 134;                  // Python 1.0 ->                A=size
    static LOAD_ATTR_A = 135;                  // Python 1.0 ->                names[A]
    static COMPARE_OP_A = 136;                 // Python 1.0 ->                cmp_ops[A]
    static IMPORT_NAME_A = 137;                // Python 1.0 ->                names[A]
    static IMPORT_FROM_A = 138;                // Python 1.0 ->                names[A]
    static ACCESS_MODE_A = 139;                // Python 1.0 - 1.4             names[A]
    static JUMP_FORWARD_A = 140;               // Python 1.0 ->                rel jmp +A
    static JUMP_IF_FALSE_A = 141;              // Python 1.0 - 2.6, 3.0        rel jmp +A
    static JUMP_IF_TRUE_A = 142;               // Python 1.0 - 2.6, 3.0        rel jmp +A
    static JUMP_ABSOLUTE_A = 143;              // Python 1.0 - 3.10            abs jmp A
    static FOR_LOOP_A = 144;                   // Python 1.0 - 2.2             rel jmp +A
    static LOAD_LOCAL_A = 145;                 // Python 1.0 - 1.4             names[A]
    static LOAD_GLOBAL_A = 146;                // Python 1.0 ->                names[A]
    static SET_FUNC_ARGS_A = 147;              // Python 1.1 - 1.4             A=count
    static SETUP_LOOP_A = 148;                 // Python 1.0 - 3.7             rel jmp +A
    static SETUP_EXCEPT_A = 149;               // Python 1.0 - 3.7             rel jmp +A
    static SETUP_FINALLY_A = 150;              // Python 1.0 - 3.10            rel jmp +A
    static RESERVE_FAST_A = 151;               // Python 1.0 - 1.2             A=count
    static LOAD_FAST_A = 152;                  // Python 1.0 ->                locals[A]
    static STORE_FAST_A = 153;                 // Python 1.0 ->                locals[A]
    static DELETE_FAST_A = 154;                // Python 1.0 ->                locals[A]
    static GEN_START_A = 155;                  // Python 3.10                  ???
    static SET_LINENO_A = 156;                 // Python 1.0 - 2.2             A=line
    static STORE_ANNOTATION_A = 157;           // Python 3.6                   names[A]
    static RAISE_VARARGS_A = 158;              // Python 1.3 ->                A=count
    static CALL_FUNCTION_A = 159;              // Python 1.3 - 3.5             A=(#args)+(#kwargs<<8)
                                               // Python 3.6 - 3.10            A=#args
    static MAKE_FUNCTION_A = 160;              // Python 1.3 - 2.7             A=#defaults
                                               // Python 3.0 - 3.5             A=(#defaults)+(#kwdefaults<<8)+(#annotations<<16)
                                               // Python 3.6 ->                A=flags
    static MAKE_FUNCTION = 272;                // Python 3.13+ ->              A=flags
    static BUILD_SLICE_A = 161;                // Python 1.4 ->                A=count
    static CALL_FUNCTION_VAR_A = 162;          // Python 1.6 - 3.5             A=(#args)+(#kwargs<<8)
    static CALL_FUNCTION_KW_A = 163;           // Python 1.6 - 3.5             A=(#args)+(#kwargs<<8)
                                               // Python 3.6 - 3.10            A=#args
    static CALL_FUNCTION_VAR_KW_A = 164;       // Python 1.6 - 3.5             A=(#args)+(#kwargs<<8)
    static CALL_FUNCTION_EX_A = 165;           // Python 3.6 ->                A=flags
    static UNPACK_SEQUENCE_A = 166;            // Python 2.0 ->                A=count
    static FOR_ITER_A = 167;                   // Python 2.0 ->                rel jmp +A
    static DUP_TOPX_A = 168;                   // Python 2.0 - 3.1             A=count
    static BUILD_SET_A = 169;                  // Python 2.7 ->                A=size
    static JUMP_IF_FALSE_OR_POP_A = 170;       // Python 2.7, 3.1 - 3.11       abs jmp A
    static JUMP_IF_TRUE_OR_POP_A = 171;        // Python 2.7, 3.1 - 3.11       abs jmp A
    static POP_JUMP_IF_FALSE_A = 172;          // Python 2.7, 3.1 - 3.10       abs jmp A
                                               // Python 3.12 ->               rel jmp +A
    static POP_JUMP_IF_TRUE_A = 173;           // Python 2.7, 3.1 - 3.10       abs jmp A
                                               // Python 3.12 ->               rel jmp +A
    static CONTINUE_LOOP_A = 174;              // Python 2.1 - 3.7             abs jmp A
    static MAKE_CLOSURE_A = 175;               // Python 2.1 - 2.7             A=#defaults
                                               // Python 3.0 - 3.5             A=(#defaults)+(#kwdefaults<<8)+(#annotations<<16)
    static LOAD_CLOSURE_A = 176;               // Python 2.1 ->                freevars[A]
    static LOAD_DEREF_A = 177;                 // Python 2.1 ->                freevars[A]
    static STORE_DEREF_A = 178;                // Python 2.1 ->                freevars[A]
    static DELETE_DEREF_A = 179;               // Python 3.2 ->                freevars[A]
    static EXTENDED_ARG_A = 180;               // Python 2.0 ->                A=extended_arg
    static SETUP_WITH_A = 181;                 // Python 2.7, 3.2 - 3.10       rel jmp +A
    static SET_ADD_A = 182;                    // Python 2.7, 3.1 ->           stack[A]
    static MAP_ADD_A = 183;                    // Python 2.7, 3.1 ->           stack[A]
    static UNPACK_EX_A = 184;                  // Python 3.0 ->                A=(before)+(after<<8)
    static LIST_APPEND_A = 185;                // Python 2.7, 3.1 ->           stack[A]
    static LOAD_CLASSDEREF_A = 186;            // Python 3.4 - 3.10            (cellvars+freevars)[A]
                                               // Python 3.11                  localsplusnames[A]
    static MATCH_CLASS_A = 187;                // Python 3.10 ->               A=#args
    static BUILD_LIST_UNPACK_A = 188;          // Python 3.5 - 3.8             A=count
    static BUILD_MAP_UNPACK_A = 189;           // Python 3.5 - 3.8             A=count
    static BUILD_MAP_UNPACK_WITH_CALL_A = 190; // Python 3.5                   A=(count)+(fnloc<<8)
                                               // Python 3.6 - 3.8             A=count
    static BUILD_TUPLE_UNPACK_A = 191;         // Python 3.5 - 3.8             A=count
    static BUILD_SET_UNPACK_A = 192;           // Python 3.5 - 3.8             A=count
    static SETUP_ASYNC_WITH_A = 193;           // Python 3.5 - 3.10            rel jmp +A
    static FORMAT_VALUE_A = 194;               // Python 3.6 ->                A=conversion_type
    static BUILD_CONST_KEY_MAP_A = 195;        // Python 3.6 ->                A=count
    static BUILD_STRING_A = 196;               // Python 3.6 ->                A=count
    static BUILD_TUPLE_UNPACK_WITH_CALL_A = 197; // Python 3.6 - 3.8             A=count
    static LOAD_METHOD_A = 198;                // Python 3.7 - 3.11            names[A]
    static CALL_METHOD_A = 199;                // Python 3.7 - 3.10            A=#args
    static CALL_FINALLY_A = 200;               // Python 3.8                   rel jmp +A
    static POP_FINALLY_A = 201;                // Python 3.8                   A=flags
    static IS_OP_A = 202;                      // Python 3.9 ->                A=inverted
    static CONTAINS_OP_A = 203;                // Python 3.9 ->                A=inverted
    static RERAISE_A = 204;                    // Python 3.10 ->               A=flag
    static JUMP_IF_NOT_EXC_MATCH_A = 205;      // Python 3.9 - 3.10            abs jmp A
    static LIST_EXTEND_A = 206;                // Python 3.9 ->                stack[A]
    static SET_UPDATE_A = 207;                 // Python 3.9 ->                stack[A]
    static DICT_MERGE_A = 208;                 // Python 3.9 ->                stack[A]
    static DICT_UPDATE_A = 209;                // Python 3.9 ->                stack[A]
    static SWAP_A = 210;                       // Python 3.11 ->               stack[A]
    static POP_JUMP_FORWARD_IF_FALSE_A = 211;  // Python 3.11                  rel jmp +A
    static POP_JUMP_FORWARD_IF_TRUE_A = 212;   // Python 3.11                  rel jmp +A
    static COPY_A = 213;                       // Python 3.11 ->               stack[A]
    static BINARY_OP_A = 214;                  // Python 3.11 ->               bin_ops[A]
    static SEND_A = 215;                       // Python 3.11 ->               rel jmp +A
    static POP_JUMP_FORWARD_IF_NOT_NONE_A = 216; // Python 3.11                  rel jmp +A
    static POP_JUMP_FORWARD_IF_NONE_A = 217;   // Python 3.11                  rel jmp +A
    static GET_AWAITABLE_A = 218;              // Python 3.11 ->               A=awaitable_type
    static JUMP_BACKWARD_NO_INTERRUPT_A = 219; // Python 3.11 ->               rel jmp -A
    static MAKE_CELL_A = 220;                  // Python 3.11 ->               locals[A]
    static JUMP_BACKWARD_A = 221;              // Python 3.11 ->               rel jmp -A
    static COPY_FREE_VARS_A = 222;             // Python 3.11 ->               A=count
    static RESUME_A = 223;                     // Python 3.11 ->               ???
    static PRECALL_A = 224;                    // Python 3.11                  A=#args
    static CALL_A = 225;                       // Python 3.11 ->               A=#args
    static KW_NAMES_A = 226;                   // Python 3.11 ->               consts[A]
    static POP_JUMP_BACKWARD_IF_NOT_NONE_A = 227; // Python 3.11                  jmp rel -A
    static POP_JUMP_BACKWARD_IF_NONE_A = 228;  // Python 3.11                  jmp rel -A
    static POP_JUMP_BACKWARD_IF_FALSE_A = 229; // Python 3.11                  jmp rel -A
    static POP_JUMP_BACKWARD_IF_TRUE_A = 230;  // Python 3.11                  jmp rel -A
    static RETURN_CONST_A = 231;               // Python 3.12 ->               consts[A]
    static LOAD_FAST_CHECK_A = 232;            // Python 3.12 ->               locals[A]
    static POP_JUMP_IF_NOT_NONE_A = 233;       // Python 3.12 ->               rel jmp +A
    static POP_JUMP_IF_NONE_A = 234;           // Python 3.12 ->               rel jmp +A
    static LOAD_SUPER_ATTR_A = 235;            // Python 3.12 ->               A=(flags&0x3)+names[A<<2]
    static LOAD_FAST_AND_CLEAR_A = 236;        // Python 3.12 ->               locals[A]
    static YIELD_VALUE_A = 237;                // Python 3.12 ->               ???
    static CALL_INTRINSIC_1_A = 238;           // Python 3.12 ->               intrinsics_1[A]
    static CALL_INTRINSIC_2_A = 239;           // Python 3.12 ->               intrinsics_2[A]
    static LOAD_FROM_DICT_OR_GLOBALS_A = 240;  // Python 3.12 ->               names[A]
    static LOAD_FROM_DICT_OR_DEREF_A = 241;    // Python 3.12 ->               localsplusnames[A]

/* Instrumented opcodes */
    static INSTRUMENTED_LOAD_SUPER_ATTR_A = 242;   // Python 3.12 ->           (see LOAD_SUPER_ATTR)
    static INSTRUMENTED_POP_JUMP_IF_NONE_A = 243;  // Python 3.12 ->           (see POP_JUMP_IF_NONE)
    static INSTRUMENTED_POP_JUMP_IF_NOT_NONE_A = 244; // Python 3.12 ->           (see POP_JUMP_IF_NOT_NONE)
    static INSTRUMENTED_RESUME_A = 245;            // Python 3.12 ->           (see RESUME)
    static INSTRUMENTED_CALL_A = 246;              // Python 3.12 ->           (see CALL)
    static INSTRUMENTED_RETURN_VALUE_A = 247;      // Python 3.12 ->           (see RETURN_VALUE)
    static INSTRUMENTED_YIELD_VALUE_A = 248;       // Python 3.12 ->           (see YIELD_VALUE)
    static INSTRUMENTED_CALL_FUNCTION_EX_A = 249;  // Python 3.12 ->           (see CALL_FUNCTION_EX)
    static INSTRUMENTED_JUMP_FORWARD_A = 250;      // Python 3.12 ->           (see JUMP_FORWARD)
    static INSTRUMENTED_JUMP_BACKWARD_A = 251;     // Python 3.12 ->           (see JUMP_BACKWARD)
    static INSTRUMENTED_RETURN_CONST_A = 252;      // Python 3.12 ->           (see RETURN_CONST)
    static INSTRUMENTED_FOR_ITER_A = 253;          // Python 3.12 ->           (see FOR_ITER)
    static INSTRUMENTED_POP_JUMP_IF_FALSE_A = 254; // Python 3.12 ->           (see POP_JUMP_IF_FALSE)
    static INSTRUMENTED_POP_JUMP_IF_TRUE_A = 255;  // Python 3.12 ->           (see POP_JUMP_IF_TRUE)
    static INSTRUMENTED_END_FOR_A = 256;           // Python 3.12 ->           (see END_FOR)
    static INSTRUMENTED_END_SEND_A = 257;          // Python 3.12 ->           (see END_SEND)
    static INSTRUMENTED_INSTRUCTION_A = 258;       // Python 3.12 ->           ???
    static INSTRUMENTED_LINE_A = 259;              // Python 3.12 ->           ???

    // Python 3.12 intrinsic function calls
    static CALL_INTRINSIC_1 = 265;                 // Python 3.12 ->           intrinsics_1[A]
    static CALL_INTRINSIC_2 = 266;                 // Python 3.12 ->           intrinsics_2[A]

    // Aliases for handler name mapping
    static CALL_INTRINSIC_1A = 238;                // Alias for CALL_INTRINSIC_1_A
    static CALL_INTRINSIC_2A = 239;                // Alias for CALL_INTRINSIC_2_A

    // Python 3.13/3.14 new opcodes
    static EXIT_INIT_CHECK = 267;                  // Python 3.13 ->           exit __init__ check
    static FORMAT_SIMPLE = 268;                    // Python 3.13 ->           format without spec
    static FORMAT_WITH_SPEC = 269;                 // Python 3.13 ->           format with spec
    static TO_BOOL = 270;                          // Python 3.13 ->           convert to bool
    static BUILD_TEMPLATE = 271;                   // Python 3.14 ->           build template object
    static LOAD_FAST_BORROW_A = 274;               // Python 3.14 ->           optimized LOAD_FAST (distinct ID from MAKE_FUNCTION=272)
    static LOAD_SMALL_INT_A = 275;                 // Python 3.14 ->           load small integer


    // enum cmp_op
    // {
    //     PyCmp_LT, PyCmp_LE, PyCmp_EQ, PyCmp_NE, PyCmp_GT, PyCmp_GE,
    //     PyCmp_IN, PyCmp_NOT_IN, PyCmp_IS, PyCmp_IS_NOT, PyCmp_EXC_MATCH, PyCmp_BAD
    // };
    
    OpCodeList = [];

    static CompareOpNames = ["<", "<=", "==", "!=", ">", ">=", "in", "not in", "is", "is not", "exception match", "BAD"];

    Instructions = [];
    CurrentInstructionIndex = -1;

    get HasInstructionsToProcess() {
        return this.CurrentInstructionIndex < this.Instructions.length - 1;
    }

    CodeObject = [];

    constructor() {
        
    }

    get Current() {
        return (this.CurrentInstructionIndex < 0 || this.CurrentInstructionIndex >= this.Instructions.length) ? null : this.Instructions[this.CurrentInstructionIndex];
    }

    GetOpCodeID(code, offset) {
        // Bounds checking for bytecode array access
        if (offset < 0 || offset >= code.length) {
            if (global.g_cliArgs?.debug) {
                console.error(`GetOpCodeID: offset ${offset} out of bounds [0, ${code.length})`);
            }
            return null;
        }

        let opcode = code[offset];
        let opcodeEntry = this.OpCodeList[opcode];

        if (!opcodeEntry) {
            if (global.g_cliArgs?.debug) {
                console.error(`GetOpCodeID: unknown opcode ${opcode} (0x${opcode?.toString(16)}) at offset ${offset}`);
            }
            return null;
        }

        return opcodeEntry.OpCodeID;
    }

    ReadExtendedArg(code, opOffset) {
        let reader = this.CodeObject.Reader;
        let argument = 0;
        let opCodeID = this.GetOpCodeID(code, opOffset);

        // If opCodeID is null, bytecode is truncated/corrupted
        if (opCodeID === null) {
            return [0, opOffset];
        }

        if (reader.versionCompare(3, 6) >= 0) {
            while (opCodeID == OpCodes.EXTENDED_ARG_A) {
                argument = argument | code[++opOffset] << 8;
                opCodeID = this.GetOpCodeID(code, ++opOffset);

                // Break if we hit end of bytecode
                if (opCodeID === null) {
                    break;
                }
            }
            argument <<= 8;
        } else {
            if (opCodeID == OpCodes.EXTENDED_ARG_A) {
                argument = code[++opOffset] | code[++opOffset] << 8;
                argument <<= 16;
            }
        }

        return [argument, opOffset];
    }

    SetupByteCode(co)
    {
        if (!co || !co.Code || !co.Code.Value) {
            return;
        }

        this.CodeObject = co;
        let opOffset = 0;
        let opCodeID = 0;
        let extendedArg = 0;
        let instructionIndex = 0;
        let code = this.CodeObject.Code.Value;

        while (opOffset < code.length) {
            [extendedArg, opOffset] = this.ReadExtendedArg(code, opOffset);

            let bytecode = code[opOffset];
            let opcodeEntry = this.OpCodeList[bytecode];

            // Skip unknown/invalid opcodes
            if (!opcodeEntry) {
                if (global.g_cliArgs?.debug) {
                    console.error(`SetupByteCode: unknown opcode ${bytecode} (0x${bytecode?.toString(16)}) at offset ${opOffset}`);
                }
                opOffset++; // Skip this byte and continue
                continue;
            }

            let opCode = opcodeEntry.Clone();
            opCode.Offset = opOffset++;
            opCode.CodeBlock = this;
            opCode.InstructionIndex = instructionIndex++;

            // Set instruction size based on Python version
            if (this.CodeObject.Reader.versionCompare(3, 6) >= 0) {
                opCode.Size = 2;  // Python 3.6+ uses 2-byte word-aligned instructions
                opCode.Argument = extendedArg | code[opOffset++];
            } else if (opCode.HasArgument) {
                opCode.Size = 3;  // Python < 3.6 with argument: opcode + 2 arg bytes
                opCode.Argument = extendedArg | code[opOffset++] | code[opOffset++] << 8;
            } else {
                opCode.Size = 1;  // Python < 3.6 without argument: just opcode
            }
  
            if (opCode.HasArgument) {
                if (opCode.OpCodeID == OpCodes.SET_LINENO_A) {
                    this.CodeObject.CachedLineNo = opCode.Argument;
                } else {
                    opCode.LineNo = this.CodeObject.getLineNumber(opCode.Offset);
                }

                if (opCode.HasConstant) {
                    let val = this.CodeObject.Consts.Value[opCode.Argument];
                    if (global.g_cliArgs?.debug && opCode.Offset < 20) {
                        console.log(`[SetupByteCode] offset=${opCode.Offset}, arg=${opCode.Argument}, Consts.length=${this.CodeObject.Consts?.Value?.length}, val=${val?.ClassName || 'null'}`);
                    }
                    if (val) {
                        opCode.ConstantObject = val;
                        switch(val.ClassName) {
                            case "Py_CodeObject":
                                opCode.Constant = opCode.Argument;
                                break;
                            case "Py_Unicode":
                            case "Py_String":
                                let strVal = val.toString();
                                if (!["\"", "\'"].includes(strVal[0])) {
                                    strVal = strVal.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("\n", "\\n");
                                    if (strVal.indexOf("'")) {
                                        opCode.Constant = `"${strVal}"`;
                                    } else {
                                        opCode.Constant = `'${strVal}'`;
                                    }
                                } else {
                                    opCode.Constant = strVal;
                                }
                                break;
                            default:
                                opCode.Constant = val.toString();
                            }
                    } else {
                        throw new Error("opCode.Argument is outside of the range")
                    }
                } else if (opCode.HasName) {
                    let nameIndex = opCode.Argument;

                    // Python 3.11+ LOAD_GLOBAL uses oparg>>1 as name index
                    if (opCode.InstructionName === 'LOAD_GLOBAL' &&
                        this.CodeObject.Reader.versionCompare(3, 11) >= 0) {
                        nameIndex = opCode.Argument >> 1;
                    }

                    if (nameIndex < this.CodeObject.Names.Value.length) {
                        opCode.Name = this.CodeObject.Names.Value[nameIndex].toString();
                    } else {
                        if (global.g_cliArgs?.debug) {
                            console.error(`HasName: opCode.Argument ${opCode.Argument} out of bounds (Names.length=${this.CodeObject.Names.Value.length})`);
                        }
                        opCode.Name = `##NAME_${opCode.Argument}##`;
                    }
                } else if (opCode.HasCompare) {
                    opCode.CompareOperator = OpCodes.CompareOpNames[opCode.Argument];
                } else if (opCode.HasLocal) {
                    if (opCode.Argument < this.CodeObject.VarNames.Value.length) {
                        opCode.Name = this.CodeObject.VarNames.Value[opCode.Argument].toString();
                    } else if (opCode.Argument < this.CodeObject.Names.Value.length) {
                        opCode.Name = this.CodeObject.Names.Value[opCode.Argument].toString();
                    }
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

    CanGoNext(offset = 1) {
        if (this.CurrentInstructionIndex + offset >= 0 && this.CurrentInstructionIndex + offset < this.Instructions.length) {
            return true;
        }
        return false;
    }

    GoNext(offset = 1) {
        if (this.CanGoNext(offset)) {
            this.CurrentInstructionIndex += offset;
            return true;
        }
        return false;
    }

    GoToOffset(offset) {
        let instructionIndex = this.GetIndexByOffset(offset);
        if (instructionIndex < 0) {
            return false;
        }
        this.CurrentInstructionIndex = instructionIndex;
        return true;
    }

    MoveBack() {
        this.GoNext(-1);
        return "";
    }

     GetNextInstruction(offset = 1) {
        if (!this.GoNext(offset)) {
            return null;
        }

        return this.Instructions[this.CurrentInstructionIndex];
    }

    //
    // Look behind and look ahead functions
    //
    get Prev() {
        if (this.CanGoNext(-1)) {
            return this.Instructions[this.CurrentInstructionIndex - 1];
        }
        return null;
    }

    get Next()
    {
        return this.PeekNextInstruction();
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

    get LastOffset() {
        return this.Instructions[this.Instructions.length - 1].Offset;
    }

    GetIndexByOffset(offset) {
        // TODO: Refactor this code to use binary search
        if (offset < 0) {
            return -1;
        }
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

    GetOpCodeByID(opCodeID, fromOffset = -1, toOffset = -1) {
        let startPosition =  fromOffset < 0 ? this.CurrentInstructionIndex + 1 : this.GetIndexByOffset(fromOffset);
        let endPosition =  toOffset <= 0 ? this.Instructions.length - 1 : this.GetIndexByOffset(toOffset);
        if (startPosition > endPosition) {
            let tempPosition = startPosition;
            startPosition = endPosition;
            endPosition = tempPosition;
        }
        for (let position = startPosition; position <= endPosition; position++) {
            if (this.Instructions[position].OpCodeID == opCodeID)
                return this.Instructions[position];
        }

        return null;
    }

    GetOpCodeByName(opCodeName, fromOffset = -1, toOffset = -1) {
        let partialMatch = false;
        let startPosition =  fromOffset < 0 ? this.CurrentInstructionIndex + 1 : this.GetIndexByOffset(fromOffset);
        let endPosition =  toOffset <= 0 ? this.Instructions.length - 1 : this.GetIndexByOffset(toOffset);
        if (startPosition > endPosition) {
            let tempPosition = startPosition;
            startPosition = endPosition;
            endPosition = tempPosition;
        }

        if (opCodeName.endsWith("*")) {
            partialMatch = true;
            opCodeName = opCodeName.substring(0, opCodeName.length - 1);
        }

        for (let position = startPosition; position <= endPosition; position++) {
            if (partialMatch) {
                if (this.Instructions[position].InstructionName.startsWith(opCodeName)) {
                    return this.Instructions[position];
                }
            } else if (this.Instructions[position].InstructionName == opCodeName) {
                return this.Instructions[position];
            }
        }

        return null;
    }


    GetOffsetByOpCode(opCodeID, fromOffset = -1, toOffset = -1) {
        let startPosition =  fromOffset < 0 ? this.CurrentInstructionIndex + 1 : this.GetIndexByOffset(fromOffset);
        let endPosition =  toOffset <= 0 ? this.Instructions.length - 1 : this.GetIndexByOffset(toOffset);
        if (startPosition > endPosition) {
            let tempPosition = startPosition;
            startPosition = endPosition;
            endPosition = tempPosition;
        }
        for (let position = startPosition; position <= endPosition; position++) {
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

    DOMINATORS = [OpCodes.SETUP_LOOP_A, OpCodes.SETUP_EXCEPT_A, OpCodes.SETUP_FINALLY_A, OpCodes.SETUP_WITH_A, OpCodes.FOR_ITER_A];

    FindEndOfBlock(originalOffset, currentOffset = -1){
        currentOffset = currentOffset == -1 ? this.Instructions[this.CurrentInstructionIndex].Offset : currentOffset;

        if (global.g_cliArgs?.debug) {
            console.log(`FindEndOfBlock(originalOffset=${originalOffset}, currentOffset=${currentOffset})`);
        }

        // NEW LOGIC: For backward jumps (loop/branch returns), scan forward to find
        // the actual end of the block by looking for JUMP instructions
        if (originalOffset < currentOffset) {
            // Try to find the end by scanning forward for JUMP instructions
            // The block ends where we find a JUMP to a DIFFERENT target
            let lastMatchingJump = -1;
            let searchLimit = 50; // reasonable limit to avoid infinite loops

            // Start scanning from current instruction index forward
            let startIdx = this.CurrentInstructionIndex;
            for (let i = 0; i < searchLimit; i++) {
                let instr = this.PeekInstructionAt(startIdx + i);
                if (!instr) break;

                // Found unconditional JUMP
                if (instr.InstructionName === 'JUMP_ABSOLUTE' || instr.InstructionName === 'JUMP_FORWARD') {
                    let jumpTarget = instr.JumpTarget;

                    if (global.g_cliArgs?.debug) {
                        console.log(`  Checking JUMP at offset ${instr.Offset}: target=${jumpTarget} vs originalOffset=${originalOffset}`);
                    }

                    // If JUMP target matches originalOffset, this is a loop-back jump
                    // Mark it as potential end, but keep scanning
                    if (jumpTarget === originalOffset) {
                        lastMatchingJump = instr.Offset;
                        if (global.g_cliArgs?.debug) {
                            console.log(`    → Matching jump found at ${instr.Offset}`);
                        }
                    } else if (lastMatchingJump > 0) {
                        // Found a JUMP with DIFFERENT target after a matching jump
                        // This means the matching jump was the end of the block
                        if (global.g_cliArgs?.debug) {
                            console.log(`    → Different target! Block ends at ${lastMatchingJump}`);
                        }
                        // Return the offset AFTER the matching jump as block end
                        return [lastMatchingJump + 3, null];
                    } else {
                        // First JUMP has different target - this might be the block end
                        if (global.g_cliArgs?.debug) {
                            console.log(`    → First JUMP has different target, block might end at ${instr.Offset}`);
                        }
                        return [instr.Offset, null];
                    }
                }
            }

            // If we found matching jumps but no different target, use last matching jump
            if (lastMatchingJump > 0) {
                if (global.g_cliArgs?.debug) {
                    console.log(`  Using last matching jump at ${lastMatchingJump + 3} as block end`);
                }
                return [lastMatchingJump + 3, null];
            }

            // FALLBACK: Old dominator-based logic
            let dominatorOp = this.PeekInstructionAtOffset(originalOffset);
            if (this.DOMINATORS.includes(dominatorOp?.OpCodeID)) {
                if (global.g_cliArgs?.debug) {
                    console.log(`  Fallback: Found dominator at ${originalOffset}: ${dominatorOp.InstructionName} → JumpTarget=${dominatorOp.JumpTarget}`);
                }
                return [dominatorOp.JumpTarget, dominatorOp];
            }
            dominatorOp = this.PeekInstructionAtOffset(originalOffset - 3);
            if (this.DOMINATORS.includes(dominatorOp?.OpCodeID)) {
                if (global.g_cliArgs?.debug) {
                    console.log(`  Fallback: Found dominator at ${originalOffset - 3}: ${dominatorOp.InstructionName} → JumpTarget=${dominatorOp.JumpTarget}`);
                }
                return [dominatorOp.JumpTarget, dominatorOp];
            }
        }

        if (global.g_cliArgs?.debug) {
            console.log(`  No dominator found, returning originalOffset=${originalOffset}`);
        }
        return [originalOffset, null];
    }

    extractImportNames(fromlist, callback) {
        let count = fromlist.Value.length;
        let partIdx = 0;
        for (let idx = this.CurrentInstructionIndex + 1; idx < this.Instructions.length; idx++) {
            let opCode = this.Instructions[idx];

            if (opCode.OpCodeID == OpCodes.POP_TOP) {
                this.CurrentInstructionIndex = idx;
                if (partIdx != count) {
                    console.log(`WARNING: `);
                }
                return;
            } else if (opCode.InstructionName.startsWith("STORE_")) {
                callback(fromlist.Value[partIdx].toString(), opCode.Label);
                partIdx++;
            }
        }
    }
}

module.exports = OpCodes;