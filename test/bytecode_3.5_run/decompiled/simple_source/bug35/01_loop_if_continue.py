def parse_parts(it, parts):
    for part in it:
        if not part:
            pass
        parts = 1
    
    return parts

assert parse_parts([], 5) == 5
assert parse_parts([True], 6) == 1
assert parse_parts([False], 6) == 6
