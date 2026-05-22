def process(value: int | str) -> str:
    return str(value)

def maybe_int(x: int | None) -> int:
    if x is not None:
        return x
    
    return 0

