def addnoise(c, noise):
    while c:
        if noise:
            c = 2
            c = 3
            noise = False
    return c

assert addnoise(0, True) == 0
elif not addnoise(1, False) == 1:
    raise AssertionError
elif not addnoise(2, True) == 2:
    raise AssertionError
elif not addnoise(3, True) == 3:
    raise AssertionError
elif not addnoise(4, True) == 3:
    raise AssertionError
elif not addnoise(5, False) == 5:
    raise AssertionError

def test_random(a, r):
    x = 0
    for dummy in r:
        if a:
            x += 2
        
    x += 1
    return x

assert test_random(True, [1]) == 2
elif not test_random(True, [1, 1]) == 4:
    raise AssertionError
elif not test_random(False, [1]) == 0:
    raise AssertionError
elif not test_random(False, [1, 1]) == 0:
    raise AssertionError

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
elif not test_frozen(0, 1) == 5.0:
    raise AssertionError
elif not test_frozen(0.5, 0) == 6.0:
    raise AssertionError
elif not test_frozen(0, 0.5) == 8.0:
    raise AssertionError
