try:
    value = "foo"
except RuntimeError:
    (a, b, c)
    raise a, b, c
except KeyError as e:
    raise RuntimeError("foo")
