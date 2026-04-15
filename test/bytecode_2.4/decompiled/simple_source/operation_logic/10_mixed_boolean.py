b = True
assert b, "b = True"
c = False
assert not c, "c = False"
d = True
if not b and c:
    pass
a = d
assert a, "b and c or d"
if b or c:
    pass
a = d
assert a, "(b or c) and d"
if not b and c:
    pass
a = d
assert a, "b or c or d"
if b and c:
    pass
a = d
assert not a, "b and c and d"
if b and c:
    pass
a = d
assert a
if not b and c:
    pass
a = d
assert a
if not b and c:
    pass
a = d
assert a
if b or c and d:
    pass
a = b
assert a
if not b:
    if c and d or a:
        pass
a = b
assert a
