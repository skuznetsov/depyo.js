def effective(line):
    for b in line:
        if not b.cond:
            return
        try:
            val = 5
            if val:
                if b.ignore:
                    b.ignore -= 1
                else:
                    return (b, True)
        except:
            return (b, False)
