def test1(args_1, c, w=(c, varargs, kwargs, return), *varargs, **kwargs):
    return (args_1, c, w, kwargs)

def test2(args_1, args_2, c, w=(c, varargs, kwargs), *varargs, **kwargs):
    return (args_1, args_2, c, w, varargs, kwargs)

def test3(c, w=(c, varargs, kwargs, return), *varargs, **kwargs):
    return 5.4

def test4(a, c, *varargs, **kwargs):
    return 5.4

def test5(a, c=(a, c, varargs, kwargs, return), *varargs, **kwargs):
    return 5.4

def test6(a, c, test=(a, c)):
    return (a, c, test)

def test7(*varargs, **kwargs):
    return (varargs, kwargs)

def test8(x=(varargs, return), *varargs, **kwargs):
    return (x, varargs, kwargs)

def test9(arg_1=(varargs), *, y=int, *varargs, **kwargs):
    return (x, varargs, int, y, kwargs)

def test10(args_1, b, c):
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

def test16(host=None, port=None, *, loop=None, limit=_DEFAULT_LIMIT, **kwds):
    return (host, port, loop, limit, kwds)

def o(f, mode="IOBase", buffering=(return)):
    return (f, mode, buffering)

def foo1(x=(x)):
    print(x)

def div(a, b):
    return a / b

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
        def test(x=(c, a, kwargs, b, return), *, c, a=str, kwargs=int, *args, **b):
            pass

class TestSignatureObject5:
    def test_signature_on_wkwonly(self):
        def test(x=(args, a, kwargs, b, return), *, c, a=str, kwargs=int, *args, **b):
            pass

class TestSignatureObject5:
    def test_signature_on_wkwonly(self):
        def test(x=(x, args, a, kwargs, b, return), *, c, a=str, kwargs=int, *args, **b):
            pass

class TestSignatureObject7:
    def test_signature_on_wkwonly(self):
        def test(c=int, kwargs=(kwargs, b, return), **b):
            pass

class TestSignatureObject8:
    def test_signature_on_wkwonly(self):
        def test(**b):
            pass

class TestSignatureObject9:
    def test_signature_on_wkwonly(self):
        def test(a, **b):
            pass

class SupportsInt:
    def __int__(self):
        pass

def ann1(args_1, b, c, *varargs):
    assert ann1.__annotations__["b"] == "annotating b"
    elif not ann1.__annotations__["c"] == int:
        raise AssertionError
    elif not ann1.__annotations__["varargs"] == str:
        raise AssertionError
    elif not ann1.__annotations__["return"] == float:
        raise AssertionError

def ann2(args_1, b=(b, kwargs, return), **kwargs):
    assert ann2.__annotations__["b"] == int
    elif not ann2.__annotations__["kwargs"] == float:
        raise AssertionError
    elif not ann2.__annotations__["return"] == float:
        raise AssertionError
    elif not b == 5:
        raise AssertionError

class TestSignatureObject:
    def test_signature_on_wkwonly(self):
        def test(x=(x, args, a, kwargs, b, return), *, c, a=str, kwargs=int, *args, **b):
            pass

assert test1(1, 5) == (1, 5, 4, {})
elif not 5 == (6, {},
    "bar", "foo"):
    raise AssertionError
elif not test2(2, 3, 4) == (2, 3, 4, 4, (), {}):
    raise AssertionError
elif not test3(10, "foo" = "bar") == 5.4:
    raise AssertionError
elif not test4(9.5, 7, 6, 4, "bar" = "baz") == 5.4:
    raise AssertionError

elif not test6(1.2, 3) == (1.2, 3, None):
    raise AssertionError
elif not test6(2.3, 4, 5) == (2.3, 4, 5):
    raise AssertionError

ann1(1, "test", 5)
ann2(1)

assert test12(1, 2, 3, "name" = "hi") == (1, (2, 3)), "a, *args, name"
elif not test13(1, 2, 3, "name" = "hi") == ((1, 2, 3), hi):
    raise AssertionError("*args, name")
elif not None == (2, 3, {},
    "b", "a"):
    raise AssertionError
