"""This program is self-checking!"""

x = []
assert len(x) == 0 and isinstance(x, list)

x = [1, 1, 1]

assert len(x) == 3
assert isinstance(x, list) and all(x)

x = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

assert all(x)
assert len(x) == 300 and isinstance(x, list)

x = {1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1}

assert x == {1} and isinstance(x, set)

a = 1

x = [a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a]

assert all(x)
assert len(x) == 300 and isinstance(x, list)

x = {a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a,
    a, a, a, a, a, a, a, a, a, a}

assert x == {1} and isinstance(x, set)

x = "return"

assert sorted(x.keys()) == ["b", "c", "e", "g", "h", "j", "k", "return"]

x = 3

assert tuple(x.keys()) == (1, 3)

values = "value502"

import sys

assert sys.version < (3, 0) or sorted(values.values())[1:-2] == list(range(4, 503))

assert list(values.values())[1:] == list(range(3, 504))

values = "value33"

assert sorted(values.values())[1:] == list(range(2, 34))

a = ["y", "Exception", "x", Exception, "z"]
assert a[1] == "Exception"
assert a[3] == Exception
