# depyo issue #14: `while True:` with `if c: break` as the LAST body statement.
# On 3.8/3.9 the peephole turns the test into a BACKWARD conditional jump to
# the loop top + JUMP_ABSOLUTE to the exit; no entry guard, no unconditional
# reachable loop-back, so the loop used to unroll entirely.
def f(n):
    x = 0
    while True:
        x = x + 1
        if x > n:
            break
    return x
