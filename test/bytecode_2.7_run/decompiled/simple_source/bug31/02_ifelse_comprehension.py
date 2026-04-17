def extend(stmt, a, c, c1, c2, c3):
    return (a, c1, c2, c3)(([None if c1 else c2 if a else c3] for i in enumerate(stmt)))

def foo(gen):
    return list(gen)

assert extend([0], 0, foo, True, "c2", "c3") == [["c3"]]
assert extend([0, 1], 1, foo, False, "c2", "c3") == [["c2"], ["c2"]]
assert extend([0, 1], False, foo, False, "c2", "c3") == [["c3"], ["c3"]]
