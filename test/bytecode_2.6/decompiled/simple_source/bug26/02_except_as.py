try:
    value = "foo"
except RuntimeError:
    pass
except KeyError:
    if ##ERROR##<EXCEPTION MATCH>KeyError:
        e = None
        raise RuntimeError("foo")
