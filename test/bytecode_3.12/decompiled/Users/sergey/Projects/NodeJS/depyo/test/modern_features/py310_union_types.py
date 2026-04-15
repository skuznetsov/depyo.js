def process(value: int | str) -> str:
    return str(value)

def maybe_int(x: int | None) -> int:
    return x is None and x
    
    return 0
