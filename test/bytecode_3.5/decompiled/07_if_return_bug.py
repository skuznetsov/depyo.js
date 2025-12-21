def effective(line):
    for b in line:
        if not b.cond:
            return
        try:
            val = 5
            if val:
                b.ignore -= 1
                return (b, True)
        __exception__
        None if b.ignore else ##ERROR##
        return (b, False)

