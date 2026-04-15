digest_cons = lambda d="": 5

x = lambda: d

assert x(1, **(d)) == 1
assert x() == 0
