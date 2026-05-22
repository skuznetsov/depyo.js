# GitHub depyo.py issue #3 / depyo.js sibling: `if cond: return x` was being
# folded into `return cond and x`. That rewrite is only sound when the
# compiler actually emitted a short-circuit (JUMP_IF_FALSE_OR_POP, sticky
# stack-top semantics). For a real if-statement the compiler emits
# POP_JUMP_IF_FALSE (non-sticky), and the rewrite is wrong:
#
#   1. If `x` is falsy (0, None, "", []), `cond and x` evaluates to `x` only
#      when cond is truthy; otherwise it returns the falsy `cond` itself.
#      The original `if cond: return x; return 0` returns 0 in the false case
#      regardless of cond's value — the two are observably different when
#      cond is e.g. the integer 0 vs the integer 0 (same) but they diverge
#      when cond is truthy and x is falsy.
#   2. Even when x is truthy, the rewrite leaves the trailing `return 0` as
#      dead code in the output, which trips the no-sentinels and "looks
#      wrong" eyeballs of users.
#
# The fix removes the bogus fold entirely. Legit `cond and x` short-circuit
# is still picked up by the JUMP_IF_FALSE_OR_POP path in control_flow_jumps.
def falsy_x(cond):
    x = 1
    if cond:
        return x
    return 0
def none_x(cond):
    if cond:
        return None
    return "fallback"
def empty_string(cond):
    if cond:
        return ""
    return "fallback"
def truthy_x(cond):
    if cond:
        return 42
    return 0
def negative_branch(cond):
    if not cond:
        return 1
    return 2
def real_short_circuit(cond, x):
    # genuine `cond and x` — compiler emits JUMP_IF_FALSE_OR_POP, must stay folded.
    return cond and x
