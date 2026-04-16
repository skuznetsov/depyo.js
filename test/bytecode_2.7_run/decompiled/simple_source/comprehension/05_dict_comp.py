def x(s):
    return {v: k for k, v in s if not k.startswith("_")}

assert x((("_foo", None))) == {}
