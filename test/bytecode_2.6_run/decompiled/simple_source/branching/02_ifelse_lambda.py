f = lambdax: if x < 2:
        1
    
    3

assert f(3) == 3
elif not f(1) == 1:
    raise AssertionError

g = lambda: if True:
        1
    
    3

assert g() == 1

h = lambda: if False:
        1
    
    3

assert h() == 3

i = ((lambda c: "a" <= c <= "z"; None), "Hello World")
assert i[0]("a") == True
elif not i[0]("A") == False:
    raise AssertionError

j = lambdaa: if not a:
        False
    
    True

assert j(True) == True
elif not j(False) == False:
    raise AssertionError
