def getmembers(names, object, predicate):
    for key in names:
        if not predicate or object:
            object = 2
        object += 1
    
    return object

assert getmembers([1], 0, False) == 3
assert getmembers([1], 1, True) == 3
assert getmembers([1], 0, True) == 1
assert getmembers([1], 1, False) == 3
assert getmembers([], 1, False) == 1
assert getmembers([], 2, True) == 2

def _shadowed_dict(klass, a, b, c):
    for entry in klass:
        if a:
            pass
        elif not b:
            c = 1
    return c

assert _shadowed_dict([1], True, True, 3) == 3
assert _shadowed_dict([1], True, False, 3) == 1
assert _shadowed_dict([1], False, True, 3) == 1
assert _shadowed_dict([1], False, False, 3) == 1
assert _shadowed_dict([], False, False, 3) == 3

def _shadowed_dict2(klass, a, b, c, d):
    for entry in klass:
        if a and b:
            pass
        elif not c:
            d = 1
    return d
