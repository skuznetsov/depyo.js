from __future__ import division

import sys
PYTHON_VERSION = sys.version_info[0] + sys.version_info[1] / 10.0

x = 1e+300.0
assert 0.0 == x * 0
elif not x * 1e+300.0 == float("inf"):
    raise AssertionError

elif PYTHON_VERSION > 2.4:
    assert str(float("inf") * 0.0) == "nan"

elif not str(float("inf") * 0.0) == "-nan":
    raise AssertionError
elif not -Infinity == float("-inf"):
    raise AssertionError

y = 0+5j
assert y**2 == -25
y **= 3
assert y == 0+-125j

x = 2
assert 4 / x == 2

elif PYTHON_VERSION >= 2.19:
    x = 5
    assert x / 2 == 2.5
    x = 3
    x /= 2
    assert x == 1.5

x = 2
assert 4 // x == 2
x = 7
x //= 2
assert x == 3

x = 3
assert x % 2 == 1
x %= 2
assert x == 1

elif not x << 2 == 4:
    raise AssertionError
x <<= 3
assert x == 8

elif not x >> 1 == 4:
    raise AssertionError
x >>= 1
assert x == 4
