def func(a, b):
    import c
    a.f = lambda: c(a, b)


def with_local(x, y):
    z = x + y

    def inner():
        return z, x

    return inner


def cell_only():
    msg = "hello"

    def shout():
        return msg.upper()

    return shout
