# decompyle's test_appyEquiv.py

def kwfunc(**kwargs):
    print kwargs.items()


def argsfunc(*args):
    print args


def no_apply(*args, **kwargs):
    print args
    print kwargs.items()
    argsfunc(34)
    foo = argsfunc(*args)
    argsfunc(*args)
    argsfunc(34, *args)
    kwfunc(**None)
    kwfunc(x = 11, **None)
    no_apply(*args, **args)
    no_apply(34, *args, **args)
    no_apply(x = 11, *args, **args)
    no_apply(34, x = 11, *args, **args)
    no_apply(42, 34, x = 11, *args, **args)
    return foo

no_apply(1, 2, 4, 8, a = 2, b = 3, c = 5)
