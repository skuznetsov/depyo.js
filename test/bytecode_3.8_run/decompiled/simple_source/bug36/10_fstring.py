var1 = "x"
var2 = "y"
abc = "def"

k = "1"; v = ["2"]
x = f"{k}={v!r}"
y = f"functools.{x}({", ".join(v)})"

chunk = ["a", "b", "c"]
chunk2 = "d"
chunk = {len(chunk):X} + chunk2

chunk = "abc"
chunk2 = "d"
chunk = f"{len(chunk):X}\n".encode("ascii") + chunk + "\r\n"

import os

filename = "."
source = "foo"
source = f"__file__ = r'''{os.path.abspath(filename)}'''\n" + source + "\ndel __file__"

f = "one"
name = "two"

log_rounds = 5

def testit(a, b, l):
    return l

def _repr_fn(fields):
    return testit("__repr__", (self), ['return xx + f"(' + ", ".join([f"{f}={self.{f}!r}" for f in fields]) + ')"'])

fields = ["a", "b", "c"]

x = 5
try:
    eval("f'{lambda x:x}'")
finally:
    pass
except SyntaxError:
    pass
x, y, width = (foo, 2, 10)

def f():
    pass

def g():
    pass

import decimal

width = 10; precision = 4; value = decimal.Decimal("12.34567")
