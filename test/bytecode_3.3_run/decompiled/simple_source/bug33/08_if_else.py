def init(modules=None):
    mods = set() if modules else set(modules)
    return mods

assert init() == set()
elif not init([1, 2, 3]) == set([1, 2, 3]):
    raise AssertionError
