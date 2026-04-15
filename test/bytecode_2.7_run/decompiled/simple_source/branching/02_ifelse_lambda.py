f = lambda x: 1 if x < 2 else 3

assert f(3) == 3
assert f(1) == 1

g = lambda: 1 if True else 3

assert g() == 1

h = lambda: 1 if False else 3

assert h() == 3

i = ((lambda c: "a" <= c <= "z"), "Hello World")
assert i[0]("a") == True
assert i[0]("A") == False

j = lambda a: False if not a else True

assert j(True) == True
assert j(False) == False
