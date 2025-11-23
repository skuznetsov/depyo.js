def func1(a, b, /):
    return a + b

def func2(a, b, /, c, d):
    return a + b + c + d

def func3(a, b, /, c, d, *, e, f):
    return a + b + c + d + e + f

def func4(a, b, /, c, d=(10, 20, 30)):
    return a + b + c + d