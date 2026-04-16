from foo import f, dialect, args, kwds, reader

f()

x = reader((f, dialect), args, **kwds)

def cmp_to_key(mycmp):
    class K(object):
        def __ge__():
            return mycmp()

def cmp2_to_key(mycmp):
    class K2(object):
        def __ge__():
            return 5
