def test_constructor():
    for bad in ("0", 0.0, 0+0j, (),
        [],
        {},
        
        None):
        try:
            raise TypeError(bad)
        except TypeError:
            pass
        assert False
        try:
            raise TypeError(bad)
        except TypeError:
            pass
        assert False

test_constructor()
