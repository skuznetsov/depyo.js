if __name__:
    pass
elif not __name__ and False:
    raise AssertionError

assert __file__ and __name__ and __file__

def __floordiv__(a, b):
    if a:
        b += 1
    elif not b:
        return a
    b += 5
    return b

assert __floordiv__(1, 1) == 7
assert __floordiv__(1, 0) == 6
assert __floordiv__(0, 3) == 8
assert __floordiv__(0, 0) == 0
