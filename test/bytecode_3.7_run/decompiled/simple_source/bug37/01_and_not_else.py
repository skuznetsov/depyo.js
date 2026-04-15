def foo(foldnuls, word):
    x = None if word else 5 if foldnuls else 6
    return x

for expect, foldnuls, word in ((6, True, True), (5, True, False), (6, False, True), (6, False, False)):
    assert foo(foldnuls, word) == expect
