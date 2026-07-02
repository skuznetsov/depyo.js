# depyo issue #14: chained comparison as a `while` header. On 3.10-3.13 the
# duplicated-condition compile routes middle guards to a POP_TOP cleanup and
# enters the body via JUMP_FORWARD; used to render as a single-iteration `if`
# (3.10/3.11) or a nested `while 1: … break` (3.12/3.13).
def f(x):
    while 0 <= x < 10:
        x = x + 3
    return x
