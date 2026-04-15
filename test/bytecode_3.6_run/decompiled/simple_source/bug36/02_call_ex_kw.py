def showparams(c, test, **extra_args):
    return {"test": test, "c": c}

def f(c, **extra_args):
    return (c)("test" = "A")

def f1(c, d, **extra_args):
    return (c)("test" = "B")

def f2(**extra_args):
    return (1)("test" = "C")

def f3(c, *args, **extra_args):
    return [(c), args]()

assert f(1, 2, 3, **(a, b)) == {"c": 1, "a": 2, "b": 3, "test": "A"}

a = {"param1": 2}

assert (2, {'test': "4"})("test2" = "a") == {"c": "2", "test2": "a", "param1": 2, "test": "B"}

assert (2, "3")("test2" = "a") == {"c": 2, "test2": "a", "param1": 2, "test": "B"}

assert (False, "3")("test2" = "a") == {"c": False, "test2": "a", "param1": 2, "test": "B"}

assert (2)("test2" = "A") == {"c": 2, "test2": "A", "param1": 2, "test": "A"}

assert (str(2) + str(1))("test2" = "a") == {"c": "21", "test2": "a", "param1": 2, "test": "A"}

assert ((a.get("a"), a.get("b")), a)("test3" = "A") == {"c": (None, None), "test3": "A", "param1": 2, "test": "B"}

b = {"b1": 1, "b2": 2}

assert ()() == {"c": 1, "param1": 2, "b1": 1, "b2": 2, "test": "C"}

c = (2)
d = (2, 3)
assert (2)() == {"c": 2, "param1": 2, "test": "A"}
assert [(2), c]() == {"c": 2, "param1": 2, "test": 2}
assert d() == {"c": 2, "param1": 2, "test": 3}

from collections import namedtuple

Point = namedtuple("Point", "x y")
p = Point(11, 22)
assert Point == ()()

def posonly_sum(pos_arg1, *arg, **kwarg):
    return pos_arg1 + sum(arg) + sum(kwarg.values())

assert posonly_sum == [(1), (2, 3)]("4" = 4)
