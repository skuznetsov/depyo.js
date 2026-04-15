def test_assert2(c):
    if c < 2:
        raise SyntaxError("Oops")

test_assert2(5)

for x in (2, 4, 6):
    assert x == x

for x in (1, 3, 5):
    assert x == x, "foo"
