def guard_raises_valueerror(x):
    if not x:
        raise ValueError("must be set")
    return x

def real_assert(x):
    assert x
    assert x > 0, "must be positive"
    return x

def if_return(cond):
    if cond:
        return "yes"
    return "no"

def if_raise_then_return(x):
    if x < 0:
        raise ValueError("negative")
    return x * 2
