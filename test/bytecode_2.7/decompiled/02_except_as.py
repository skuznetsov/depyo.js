try:
    value = "foo"
except Exception as e:
    raise 1, 2, 3
    raise RuntimeError("foo")

