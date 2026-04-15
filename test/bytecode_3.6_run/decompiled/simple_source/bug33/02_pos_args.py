digest_cons = lambda d="": 5

x = lambda: d

assert x(d=1) == 1
assert x() == 0
