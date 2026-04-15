f = lambda x: 1 if x < 2 else 3

f(5)

g = lambda: 1

g()

h = lambda: 1 if False else 3

h()

((lambda c: "a" <= c <= "z"), "Hello World")
