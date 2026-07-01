def two_operand(x):
    if 0 <= x < 100:
        foo()
    return x

def three_operand(x):
    if 0 <= x < 100 < 200:
        foo()
    return x

def chain_and(x, y):
    if 0 <= x < 100 and y:
        foo()
    return x

def negated(x):
    if not 0 <= x < 100:
        foo()
    return x
