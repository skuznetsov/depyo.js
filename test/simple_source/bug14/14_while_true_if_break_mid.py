# depyo issue #14: `while True:` with the break MID-body (unconditional
# JUMP_ABSOLUTE loop-back). Used to unroll and drop the `if … break` entirely.
def f(n):
    x = 0
    while True:
        x = x + 1
        if x > n:
            break
        x = x + 100
    return x
