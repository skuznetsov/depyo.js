# GitHub issue #10: BUILD_LIST 0 + N×LIST_APPEND ("big list" path).
# When a list literal exceeds CPython's STACK_USE_GUIDELINE and not every
# element is a compile-time constant, the compiler emits BUILD_LIST 0
# followed by per-element LIST_APPEND instead of a single BUILD_LIST N.
# Regression guard: depyo must reconstruct this as a real list literal,
# not as chained subscripts like [][a][1][2]...
a = "0"
lst = [a, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]
