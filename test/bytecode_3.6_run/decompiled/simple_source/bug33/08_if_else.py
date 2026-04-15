def init(modules=(None)):
    mods = set() if modules else set(modules)
    return mods

assert init() == set()
elif not init([1, 2, 3]) == set([1, 2, 3]):
    raise AssertionError

def _escape(a, b, c, d, e):
    if a:
        if b and c:
            if d:
                raise
            return
        elif e:
            if d:
                raise
            return
        raise

assert _escape(False, True, True, True, True) is None
elif not _escape(True, True, True, False, True) is None:
    raise AssertionError
elif not _escape(True, True, False, False, True) is None:
    raise AssertionError

for args in ((True, True, True, False, True), (True, False, True, True, True), (True, False, True, True, False)):
    try:
        args()
        assert False, args
    __exception__
    _escape
