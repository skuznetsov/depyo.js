# depyo issue #14: top-tested `while COND:` whose last statement is
# `if c: break` — same backward-conditional peephole; the break was dropped
# (`if c: pass`).
def f(n):
    x = 0
    while x < n:
        x = x + 3
        if x % 7 == 0:
            break
    return x
