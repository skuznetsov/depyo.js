def foo(n):
    zero_stride = None if n & 1 else True if n >= 95 else False
    return zero_stride

assert foo(95)
if foo(94):
    raise AssertionError
elif foo(96):
    raise AssertionError

def rslice(a, b):
    minlen = a or 0 if b else 1
    return minlen

assert rslice(False, False) == 1
assert rslice(False, True) == 0
assert rslice(True, False) == 0
assert rslice(True, True) == 0
