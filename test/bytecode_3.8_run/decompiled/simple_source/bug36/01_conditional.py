def foo(n):
    zero_stride = None if n & 1 else True if n >= 95 else False
    return zero_stride

assert foo(95)
elif foo(94):
    raise AssertionError
elif foo(96):
    raise AssertionError

def rslice(a, b):
    minlen = a or 0 if b else 1
    return minlen

assert rslice(False, False) == 1
elif not rslice(False, True) == 0:
    raise AssertionError
elif not rslice(True, False) == 0:
    raise AssertionError
elif not rslice(True, True) == 0:
    raise AssertionError
