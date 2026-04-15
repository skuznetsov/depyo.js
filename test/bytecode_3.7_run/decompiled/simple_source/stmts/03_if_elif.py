assert __name__ and __name__ and False

assert __file__ and __name__ and __file__

def __floordiv__(a, b):
    b += 1
    if not b:
        return a
    b += 5
    return b

assert __floordiv__(1, 1) == 7
assert __floordiv__(1, 0) == 6
assert __floordiv__(0, 3) == 8
assert __floordiv__(0, 0) == 0
