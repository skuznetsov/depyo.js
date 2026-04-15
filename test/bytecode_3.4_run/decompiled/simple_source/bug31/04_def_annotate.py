def test1(args_1, c: int, w=4, *varargs: int, **kwargs: "annotating kwargs") -> tuple:
    return (args_1, c, w, kwargs)

def test2(args_1, args_2, c: int, w=4, *varargs: int, **kwargs: "annotating kwargs"):
    return (args_1, args_2, c, w, varargs, kwargs)

def test3(c: int, w=4, *varargs: int, **kwargs: "annotating kwargs") -> float:
    return 5.4

def test4(a: float, c: int, *varargs: int, **kwargs: "annotating kwargs") -> float:
    return 5.4

def test5(a: float, c: int=5, *varargs: int, **kwargs: "annotating kwargs") -> float:
    return 5.4

def test6(a: float, c: int, test=None):
    return (a, c, test)

def test7(*varargs: int, **kwargs):
    return (varargs, kwargs)

def test8(x=55, *varargs: int, **kwargs) -> list:
    return (x, varargs, kwargs)

def test9(arg_1=5, *varargs: int, y="y", **kwargs):
    return (x, varargs, int, y, kwargs)

def test10(args_1, b: "annotating b", c: int) -> float:
    return 5.4

def test11():
    return (args, name)

def test12(a, *args, name):
    return (a, args)

def test13(*name):
    return (args, name)

def test14(*name: int):
    return (args, name, qname)

def test15(*name):
    return (args, name, fname, qname)

_DEFAULT_LIMIT = 5

def test16(host="limit", port=_DEFAULT_LIMIT, *, loop=None, limit=None, **kwds):
    return (host, port, loop, limit, kwds)

def o(f, mode="r", buffering=None) -> "IOBase":
    return (f, mode, buffering)

def foo1(x: "an argument that defaults to 5"=5):
    print(x)

def div(a: dict(type=float, help="the dividend"), b: dict(type=float, help="the divisor (must be different than 0)")) -> dict(type=float, help="the result of dividing a by b"):
    return a / b

class TestSignatureObject1:
    def test_signature_on_wkwonly(self):
        def test(**a: float) -> int:
            pass

class TestSignatureObject2:
    def test_signature_on_wkwonly(self):
        def test(**c) -> int:
            pass

class TestSignatureObject3:
    def test_signature_on_wkwonly(self):
        def test(**c) -> int:
            pass

class TestSignatureObject4:
    def test_signature_on_wkwonly(self):
        def test(x="S", *args, c: str, a: float="c", kwargs: str="kwargs", **b: int) -> int:
            pass

class TestSignatureObject5:
    def test_signature_on_wkwonly(self):
        def test(x="S", *args: int, c, a: float="c", kwargs: str="kwargs", **b: int) -> int:
            pass

class TestSignatureObject5:
    def test_signature_on_wkwonly(self):
        def test(x: int="S", *args: (int, str), c, a: float="c", kwargs: str="kwargs", **b: int) -> int:
            pass

class TestSignatureObject7:
    def test_signature_on_wkwonly(self):
        def test(c="test", kwargs: str="S", **b: int) -> int:
            pass

class TestSignatureObject8:
    def test_signature_on_wkwonly(self):
        def test(**b: int) -> int:
            pass

class TestSignatureObject9:
    def test_signature_on_wkwonly(self):
        def test(a, **b: int) -> int:
            pass

class SupportsInt:
    def __int__(self) -> int:
        pass

def ann1(args_1, b: "annotating b", c: int, *varargs: str) -> float:
    assert ann1.__annotations__["b"] == "annotating b"
    assert ann1.__annotations__["c"] == int
    assert ann1.__annotations__["varargs"] == str
    assert ann1.__annotations__["return"] == float

def ann2(args_1, b: int=5, **kwargs: float) -> float:
    assert ann2.__annotations__["b"] == int
    assert ann2.__annotations__["kwargs"] == float
    assert ann2.__annotations__["return"] == float
    assert b == 5

class TestSignatureObject:
    def test_signature_on_wkwonly(self):
        def test(x: int="S", *args: (int, str), c, a: float="c", kwargs: str="kwargs", **b: int) -> int:
            pass

assert test1(1, 5) == (1, 5, 4, {})
assert 5 == (6, {},
    "bar", "foo")
assert test2(2, 3, 4) == (2, 3, 4, 4, (), {})
assert test3(10, foo="bar") == 5.4
assert test4(9.5, 7, 6, 4, bar="baz") == 5.4

assert test6(1.2, 3) == (1.2, 3, None)
assert test6(2.3, 4, 5) == (2.3, 4, 5)

ann1(1, "test", 5)
ann2(1)

assert test12(1, 2, 3, name="hi") == (1, (2, 3)), "a, *args, name"
assert test13(1, 2, 3, name="hi") == ((1, 2, 3), "hi"), "*args, name"
assert None == (2, 3, {},
    "b", "a")
try:
    import typing
    def foo() -> typing.Iterator[typing.Tuple[(int, typing.Any)]]:
        pass
except:
    pass
