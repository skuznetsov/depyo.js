# depyo issue #14: `if not c: continue` + bare `break` tail — the peephole
# inverts it into a forward conditional EXIT directly over the loop-back.
def f(n):
    x = 0
    while True:
        x = x + 1
        if not x > n:
            continue
        break
    return x
