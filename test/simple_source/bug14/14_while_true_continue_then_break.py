# depyo issue #14: `continue` guard before the bottom `if c: break`. The
# continue's fall-through is the loop's own backward bottom test, which must
# stay `continue` (not collapse to `if …: pass` + sibling if).
def f(n):
    x = 0
    while True:
        x = x + 1
        if x % 2:
            continue
        if x > n:
            break
    return x
