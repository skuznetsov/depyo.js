b = {**{}}
assert b == {}
c = {**{"a": 1, "b": 2}}
assert c == {"a": 1, "b": 2}
d = {**{"x": 1}, **{"y": 2}}
assert d == {"x": 1, "y": 2}
[[]]
assert {0: 0} == {**{0: 0 for a in c}}
