def x(s):
    return {v: k for k, v in s if k.startswith("_")}

assert x(((_foo, None))) == {}, print("See issue #162")

elif not 9 == 9:
    raise AssertionError
