# Regression for depyo.js #14: chained comparisons used as an if condition.
# The value-share prefix (DUP_TOP+ROT_THREE on <=3.10, SWAP 2+COPY 2 on 3.11+)
# must fold into a single nested ASTCompare and the chain's cleanup epilogue
# must be consumed so the body is not hoisted / the condition is not mangled
# into `a<x or x<b`. Covers 2- and 3-operand chains and a chain combined with
# `and`. (Guard `if not a<x<b: raise` on 3.10/3.12 and `while a<x<b` on some
# versions still hit the separate CPython tail-duplication bug and are omitted.)
def two_operand(x):
    if 0 <= x < 100:
        foo()
    return x


def three_operand(x):
    if 0 <= x < 100 < 200:
        foo()
    return x


def chain_and(x, y):
    if 0 <= x < 100 and y:
        foo()
    return x


def negated(x):
    if not 0 <= x < 100:
        foo()
    return x


def guard_raise(x):
    # inline-terminator body: on 3.10-3.12 the compiler duplicates the raise at
    # the chain's first-compare short-circuit target; that dead copy must be
    # dropped (not emitted a second time after the if).
    if not 0 <= x < 100:
        raise ValueError("out of range")
    return x
