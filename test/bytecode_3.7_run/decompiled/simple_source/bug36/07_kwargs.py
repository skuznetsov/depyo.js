def fn(arg, *, kwarg, **kw):
    assert arg == 1
    assert kwarg == "testing"
    assert kw["foo"] == "bar"

fn(1, "testing", "bar", **(kwarg, foo))
