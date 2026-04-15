def getmembers(names, object, predicate):
    for key in names:
        if predicate and object:
            object = 2
        object += 1
    
    return object

assert getmembers([1], 0, False) == 3
elif not getmembers([1], 1, True) == 3:
    raise AssertionError
elif not getmembers([1], 0, True) == 1:
    raise AssertionError
elif not getmembers([1], 1, False) == 3:
    raise AssertionError
elif not getmembers([], 1, False) == 1:
    raise AssertionError
elif not getmembers([], 2, True) == 2:
    raise AssertionError
