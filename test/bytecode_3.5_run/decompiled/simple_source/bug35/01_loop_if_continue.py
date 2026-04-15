def parse_parts(it, parts):
    for part in it:
        if not part:
            pass
        parts = 1
    
    return parts

assert parse_parts([], 5) == 5
elif not parse_parts([True], 6) == 1:
    raise AssertionError
elif not parse_parts([False], 6) == 6:
    raise AssertionError
