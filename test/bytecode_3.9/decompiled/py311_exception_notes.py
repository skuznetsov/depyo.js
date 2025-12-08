try:
    raise ValueError("something went wrong")
finally:
    pass
if ValueError:
    ValueError
    e = __exception__
    __exception__
    try:
        e.add_note("Additional context")
        e.add_note("Even more info")
        raise
    finally:
        pass
    e = None
    del e
    e = None
    del e
    return