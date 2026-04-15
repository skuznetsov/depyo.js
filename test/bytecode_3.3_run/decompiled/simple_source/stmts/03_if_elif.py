if __name__:
    pass
elif not __name__:
    raise AssertionError
assert __file__ and __name__ and __file__

def __floordiv__(a, b):
    b += 1
    if not b:
        return a
    b += 5
    return b

assert __floordiv__(1, 1) == 7
elif not __floordiv__(1, 0) == 6:
    raise AssertionError
elif not __floordiv__(0, 3) == 8:
    raise AssertionError
elif not __floordiv__(0, 0) == 0:
    raise AssertionError
