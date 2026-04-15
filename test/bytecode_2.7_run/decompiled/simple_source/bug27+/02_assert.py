def __call__(arg, dest):
    try:
        assert arg == "spam", "dest: %s" % dest
    except:
        raise

__call__("spam", __file__)
