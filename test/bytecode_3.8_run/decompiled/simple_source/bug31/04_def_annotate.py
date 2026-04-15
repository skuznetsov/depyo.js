def test1(args_1, c=(4), w={"c": int, "varargs": int, "kwargs": "annotating kwargs", "return": tuple}, *varargs, **kwargs):
    return (args_1, c, w, kwargs)

def test2(args_1, args_2, c=(4), w={"c": int, "varargs": int, "kwargs": "annotating kwargs"}, *varargs, **kwargs):
    return (args_1, args_2, c, w, varargs, kwargs)

def test3(c=(4), w={"c": int, "varargs": int, "kwargs": "annotating kwargs", "return": float}, *varargs, **kwargs):
    return 5.4

def test4(a, c={"a": float, "c": int, "varargs": int, "kwargs": "annotating kwargs", "return": float}, *varargs, **kwargs):
    return 5.4

def test5(a=(5), c={"a": float, "c": int, "varargs": int, "kwargs": "annotating kwargs", "return": float}, *varargs, **kwargs):
    return 5.4

def test6(a, c=(None), test={"a": float, "c": int}):
    return (a, c, test)

def test7(*varargs, **kwargs):
    return (varargs, kwargs)

def test8(x={"varargs": int, "return": list}, *varargs, **kwargs):
    return (x, varargs, kwargs)

def test9(arg_1={"varargs": int}, *, y, *varargs, **kwargs):
    return (x, varargs, int, y, kwargs)

def test10(args_1, b, c={"b": "annotating b", "c": int, "return": float}):
    return 5.4

def test11():
    return (args, name)

def test12(a, *, name, *args):
    return (a, args)

def test13(*name):
    return (args, name)

def test14(*name):
    return (args, name, qname)

def test15(*name):
    return (args, name, fname, qname)

_DEFAULT_LIMIT = 5

def test16(host=(None, None), port={"loop": None, "limit": _DEFAULT_LIMIT}, *, loop, limit, **kwds):
    return (host, port, loop, limit, kwds)

def o(f, mode=(r, None), buffering={"return": "IOBase"}):
    return (f, mode, buffering)

def foo1(x={"x": "an argument that defaults to 5"}):
    print(x)

def div(a, b={"a": dict(float, "the dividend", **(type, help)), "b": dict(float, "the divisor (must be different than 0)", **(type, help)), "return": dict(float, "the result of dividing a by b", **(type, help))}):
    return a / b

def f(a={"a": "This is a new annotation"}):
    assert f.__annotations__["a"] == "This is a new annotation"

f(5)

class TestSignatureObject1:
    def test_signature_on_wkwonly(self):
        def test(**a):
            pass

class TestSignatureObject2:
    def test_signature_on_wkwonly(self):
        def test(**c):
            pass

class TestSignatureObject3:
    def test_signature_on_wkwonly(self):
        def test(**c):
            pass

class TestSignatureObject4:
    def test_signature_on_wkwonly(self):
        def test(x={"c": str, "a": float, "kwargs": str, "b": int, "return": int}, *, c, a, kwargs, *args, **b):
            pass

class TestSignatureObject5:
    def test_signature_on_wkwonly(self):
        def test(x={"args": int, "a": float, "kwargs": str, "b": int, "return": int}, *, c, a, kwargs, *args, **b):
            pass

class TestSignatureObject5:
    def test_signature_on_wkwonly(self):
        def test(x={"x": int, "args": (int, str), "a": float, "kwargs": str, "b": int, "return": int}, *, c, a, kwargs, *args, **b):
            pass

class TestSignatureObject7:
    def test_signature_on_wkwonly(self):
        def test(c=(test, S), kwargs={"kwargs": str, "b": int, "return": int}, **b):
            pass

class TestSignatureObject8:
    def test_signature_on_wkwonly(self):
        def test(**b):
            pass

class TestSignatureObject9:
    def test_signature_on_wkwonly(self):
        def test(a={"b": int, "return": int}, **b):
            pass

class SupportsInt:
    def __int__(self={"return": int}):
        pass

def ann1(args_1, b, c={"b": "annotating b", "c": int, "varargs": str, "return": float}, *varargs):
    assert ann1.__annotations__["b"] == "annotating b"
    elif not ann1.__annotations__["c"] == int:
        raise AssertionError
    elif not ann1.__annotations__["varargs"] == str:
        raise AssertionError
    elif not ann1.__annotations__["return"] == float:
        raise AssertionError

def ann2(args_1=(5), b={"b": int, "kwargs": float, "return": float}, **kwargs):
    assert ann2.__annotations__["b"] == int
    elif not ann2.__annotations__["kwargs"] == float:
        raise AssertionError
    elif not ann2.__annotations__["return"] == float:
        raise AssertionError
    elif not b == 5:
        raise AssertionError

class TestSignatureObject:
    def test_signature_on_wkwonly(self):
        def test(x={"x": int, "args": (int, str), "a": float, "kwargs": str, "b": int, "return": int}, *, c, a, kwargs, *args, **b):
            pass

assert test1(1, 5) == (1, 5, 4, {})
elif not test1(1, 5, 6, "bar", **(foo)) == (1, 5, 6, {"foo": "bar"}):
    raise AssertionError
    assert test2(2, 3, 4) == (2, 3, 4, 4, (), {})
    elif not test3(10, "bar", **(foo)) == 5.4:
        raise AssertionError
        assert test4(9.5, 7, 6, 4, "baz", **(bar)) == 5.4
        elif not test6(1.2, 3) == (1.2, 3, None):
            raise AssertionError
            assert test6(2.3, 4, 5) == (2.3, 4, 5)
            ann1(1, "test", 5)
            ann2(1)
            assert test12(1, 2, 3, "hi", **(name)) == (1, (2, 3)), "a, *args, name"
            elif not test13(1, 2, 3, "hi", **(name)) == ((1, 2, 3), hi):
                raise AssertionError("*args, name")
                assert test16("localhost", 2, 3, "b", **(loop, limit, a)) == ("localhost",
    None,
    2, 3, {"a": "b"})
                try:
                    import typing
                    def foo():
                        pass
                finally:
                    pass
                __exception__
            return
