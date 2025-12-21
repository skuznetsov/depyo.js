def process(value={"value": int | str, "return": str}):
    return str(value)

def maybe_int(x={"x": int | None, "return": int}):
    return x is not None and x
    
    return 0

