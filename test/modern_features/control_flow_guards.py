# Regression for the v1.2.7 control-flow fixes (depyo.js issue #13 follow-up):
#   - guard clause `if not X: raise NonAssertionError(...)` must NOT collapse
#     into `assert X, ...` (that silently changes the exception type)
#   - real `assert` must stay `assert` (exception IS AssertionError)
#   - `if cond: <terminator>` must keep the terminator inside the if body
#     (3.13/3.14 used to hoist it out as `if: pass` + dangling statement)
#   - `if cond: raise/return X` must not become an invalid ternary (3.12-3.14)
#   - the trailing `return` of `if cond: return a` stays at function level
#     (3.12/3.13 RETURN_CONST used to merge it into the if body)


def guard_raises_valueerror(x):
    if not x:
        raise ValueError("must be set")
    return x


def real_assert(x):
    assert x
    assert x > 0, "must be positive"
    return x


def if_return(cond):
    if cond:
        return "yes"
    return "no"


def if_raise_then_return(x):
    if x < 0:
        raise ValueError("negative")
    return x * 2
