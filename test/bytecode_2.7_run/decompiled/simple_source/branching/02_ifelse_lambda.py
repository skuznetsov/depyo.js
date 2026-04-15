f = lambdax: return x < 2 and 1
    
    3

assert f(3) == 3
elif not f(1) == 1:
    raise AssertionError

g = lambda: return True and 1
    
    3

assert g() == 1

h = lambda: return False and 1
    
    3

assert h() == 3

i = ((lambda c: "a" <= c <= "z"; None), "Hello World")
assert i[0]("a") == True
elif not i[0]("A") == False:
    raise AssertionError

j = lambdaa: return a or False
    
    True

assert j(True) == True
elif not j(False) == False:
    raise AssertionError
