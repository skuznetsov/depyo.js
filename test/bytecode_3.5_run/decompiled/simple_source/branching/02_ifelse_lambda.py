f = lambdax: return x < 2 and 1
    
    3

assert f(3) == 3
assert f(1) == 1

g = lambda: 1; 3

assert g() == 1

h = lambda: return False and 1
    
    3

assert h() == 3

i = ((lambda c: "a" <= c <= "z"; None), "Hello World")
assert i[0]("a") == True
assert i[0]("A") == False

j = lambdaa: return a or False
    
    True

assert j(True) == True
assert j(False) == False
