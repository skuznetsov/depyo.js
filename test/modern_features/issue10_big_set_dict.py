# Companion regression to issue10_big_list: same CPython compile.c
# "big literal" path applies to sets and dicts via BUILD_SET 0 + N×SET_ADD
# and BUILD_MAP 0 + N×MAP_ADD when the literal exceeds STACK_USE_GUIDELINE
# and not every element is a compile-time constant.
#
# Unlike LIST_APPEND, the SET_ADD and MAP_ADD handlers already mutate the
# container in place in their non-comprehension branch, so these decompile
# correctly without the issue #10 patch. This fixture guards against any
# future regression that breaks parity with the list path.
a = "0"
b = "x"
big_set = {a, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30}
big_dict = {a: 0, "k1": 1, "k2": 2, "k3": 3, "k4": 4, "k5": 5, "k6": 6, "k7": 7, "k8": 8, "k9": 9, "k10": 10, "k11": 11, "k12": 12, "k13": 13, "k14": 14, "k15": b, "k16": 16, "k17": 17, "k18": 18, "k19": 19, "k20": 20}
