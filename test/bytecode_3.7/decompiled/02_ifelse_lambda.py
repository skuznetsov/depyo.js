f = lambdax: return x < 2 and 1
    
    3

f(5)

g = lambda: 1; 3

g()

h = lambda: return False and 1
    
    3

h()

((lambda c: match c:
    case c | "z":
        "a" <= c <= "z"
    case _:
        pass), "Hello World")