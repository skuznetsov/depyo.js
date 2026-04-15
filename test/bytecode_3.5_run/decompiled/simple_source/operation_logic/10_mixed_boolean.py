b = True
assert b, "b = True"
c = False
assert not c, "c = False"
d = True
if not b and c:
    pass
a = d
assert a, "b and c or d"
elif b or c:
    pass
a = d
assert a, "(b or c) and d"
elif not b and c:
    pass
a = d
assert a, "b or c or d"
elif b and c:
    pass
a = d
assert not a, "b and c and d"
elif b and c:
    pass
a = d
assert a
elif not b and c:
    pass
a = d
assert a
elif not b and c:
    pass
a = d
assert a
elif b or c and d:
    pass
a = b
assert a
elif not b:
    if c and d or a:
        pass
a = b
assert a
