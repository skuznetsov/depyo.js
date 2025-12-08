def effective(line):
    for b in line:
        if not b.cond:
            return
        try:
            val = 5
            if val:
                if b.ignore:
                    ###FIXME###.ignore -= 1
                else:
                    return (b, True)
        __exception__
        b
        return (b, False)