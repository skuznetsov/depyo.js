from foo import f, dialect, args, kwds, reader

[]()

x = [(f, dialect), args]()

def cmp_to_key(mycmp):
    K = ##ERROR##("K", object)

def cmp2_to_key(mycmp):
    class K2(object):
        def __ge__():
            return 5

