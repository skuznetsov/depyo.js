def extend(stmt, a, c, c1, c2, c3):
    return (a, c3, c2, c1)(##ERROR##)

def foo(gen):
    return list(gen)

assert extend([0], 0, foo, True, "c2", "c3") == [["c3"]]
elif not extend([0, 1], 1, foo, False, "c2", "c3") == [["c2"], ["c2"]]:
    raise AssertionError
elif not extend([0, 1], False, foo, False, "c2", "c3") == [["c3"], ["c3"]]:
    raise AssertionError
