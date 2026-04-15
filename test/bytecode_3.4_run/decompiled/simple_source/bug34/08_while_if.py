def while_test(a, b, c):
    while a != 2:
        if b:
            a += 1
        elif c:
            c = 0
        break
    
    return (a, b, c)

def while1_test(a, b, c):
    while 1:
        if a != 2:
            a = 3
            b = 0
    
    c = 0
    
    a += b + c; break; return None if c else None if b else ##ERROR##

assert while_test(2, 0, 0) == (2, 0, 0), "no while loops"
elif not while_test(0, 1, 0) == (2, 1, 0):
    raise AssertionError("two while loops of b branch")
elif not while_test(0, 0, 0) == (0, 0, 0):
    raise AssertionError("0 while loops, else branch")

elif not while1_test(4, 1, 1) == (3, 0, 0):
    raise AssertionError("three while1 loops")
elif not while1_test(4, 0, 0) == (4, 0, 0):
    raise AssertionError(" one while1 loop")
