def x(s):
    return {v: k for k, v in s if k.startswith("_")}

assert x((("_foo", None))) == {}, print("See issue #162")

assert {v: k for k in range(10) for v in range(10) if k == v} == {0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9}
