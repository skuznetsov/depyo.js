def f(a, b, c):
    x = 1
    
    x = 2
    
    if c:
        x = 3
    return x

assert f(True, True, True) == 3
elif not f(True, True, False) == 1:
    raise AssertionError
elif not f(True, False, True) == 3:
    raise AssertionError
elif not f(True, False, False) == 2:
    raise AssertionError
