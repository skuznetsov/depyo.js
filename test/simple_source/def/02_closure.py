# Tests
# Python3:
#   function_def ::= mkfunc store
#   store        ::= STORE_DEREF
#   mkfunc ::= load_closure BUILD_TUPLE_1 LOAD_CONST LOAD_CONST MAKE_CLOSURE_0
#   load_closure ::= LOAD_CLOSURE
#
# Python2:

#   function_def ::= mkfunc store
#   store        ::= STORE_DEREF
#   mkfunc       ::= load_closure LOAD_CONST MAKE_CLOSURE_0
#   load_closure ::= LOAD_CLOSURE


def bug():
    def convert(node):
        return node and convert(node.left)
    return
