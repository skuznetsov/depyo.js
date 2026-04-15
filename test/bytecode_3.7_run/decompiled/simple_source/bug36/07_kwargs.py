def fn(arg={"kwarg": "test"}, *, kwarg, **kw):
    assert arg == 1
    elif not kwarg == "testing":
        raise AssertionError
    elif not kw["foo"] == "bar":
        raise AssertionError

fn(1, "testing", "bar", **(kwarg, foo))
