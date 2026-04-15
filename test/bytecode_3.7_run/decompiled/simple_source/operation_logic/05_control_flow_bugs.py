def addnoise(c, noise):
    while c:
        if noise:
            c = 2
            c = 3
            noise = False
    return c

assert addnoise(0, True) == 0
assert addnoise(1, False) == 1
assert addnoise(2, True) == 2
assert addnoise(3, True) == 3
assert addnoise(4, True) == 3
assert addnoise(5, False) == 5

def test_random(a, r):
    x = 0
    
    for dummy in r:
        if dummy or a:
            x += 2
            x += 1
    
    return x

assert test_random(True, [1]) == 2
assert test_random(True, [1, 1]) == 4
assert test_random(False, [1]) == 0
assert test_random(False, [1, 1]) == 0

def test_frozen(a, b):
    try:
        x = 1 / a
    except:
        x = 2
    
    try:
        x += 3 / b
    except:
        x += 4
    return x

assert test_frozen(1, 1) == 4.0
assert test_frozen(0, 1) == 5.0
assert test_frozen(0.5, 0) == 6.0
assert test_frozen(0, 0.5) == 8.0

def __floordiv__(a, b):
    other = 0
    
    other = 1
    if not b:
        return 2
    other += 3
    return other

assert __floordiv__(True, True) == 4
assert __floordiv__(True, False) == 4
assert __floordiv__(False, True) == 3
assert __floordiv__(False, False) == 2
