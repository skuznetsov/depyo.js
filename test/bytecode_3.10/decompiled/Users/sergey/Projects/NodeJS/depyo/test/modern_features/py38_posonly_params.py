def func1(a, b, /):
    return a + b

def func2(a, b, /, c, d):
    return a + b + c + d

def func3(a, b, /, c, d, *, e, f):
    return a + b + c + d + e + f

def func4(a, b=10, /, c=20, d=30):
    return a + b + c + d
