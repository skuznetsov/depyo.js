f = lambda x: if x < 2:
        1
    
    3

assert f(3) == 3
assert f(1) == 1

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
assert i[0]("A") == False

j = lambda a: if not a:
        False
    
    True

assert j(True) == True
assert j(False) == False
