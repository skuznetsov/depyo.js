# GitHub depyo.js issue #11: KW_NAMES + PRECALL/CALL handling broken for 3.11/3.12.
#
# CPython 3.11/3.12 emit a KW_NAMES(consti) instruction before PRECALL/CALL where
# co_consts[consti] is guaranteed to be a tuple of strings. The trailing N
# positional slots on the data stack are then rebound as kwargs by CALL, whose
# oparg is the total positional+keyword count.
#
# Two bugs were fixed together:
#   1. `handleKwNamesA` read `ConstantObject` as a JS array; it is actually a
#      PythonObject (Py_Tuple/Py_SmallTuple), so element access via `keys[idx]`
#      returned `undefined`. Keys must come from `ConstantObject.Value`.
#   2. The CALL handler decremented `kwparams` (high byte, always 0 in 3.11/3.12)
#      instead of `pparams` (low byte, the total count) when consuming the
#      ASTKwNamesMap, so the subsequent positional pop overshot by `kwcount`,
#      eating the callable and producing `##ERROR##(func, =val)`.
#
# Regression coverage spans 3.11, 3.12 (the KW_NAMES path) and 3.13, 3.14 (which
# use CALL_KW instead of KW_NAMES — parity guard against a future "unify the kw
# handlers" refactor regressing this).
def func(*a, **kw):
    return (a, kw)
class Obj:
    def meth(self, **kw):
        return kw
obj = Obj()
single = func(b=2)
mixed_one = func(1, b=2)
mixed_many = func(1, 2, a=3, b=4)
method = obj.meth(x=5)
many_kwargs = dict(a=1, b=2, c=3)
builtin = print("hi", end="", flush=True)
