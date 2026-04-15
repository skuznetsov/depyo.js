try:
    value = "foo"
except RuntimeError:
    raise 1, 2, 3
except KeyError as e:
    raise RuntimeError("foo")
