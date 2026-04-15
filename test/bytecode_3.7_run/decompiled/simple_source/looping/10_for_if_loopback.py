def _slotnames(cls):
    names = []
    for c in cls.__mro__:
        if "__slots__" in c.__dict__:
            slots = c.__dict__["__slots__"]
            for name in slots:
                if name == "__dict__":
                    continue
                names.append(name)
            

def lasti2lineno(linestarts, a):
    for i in linestarts:
        if a:
            return a
    
    return -1

assert lasti2lineno([], True) == -1
assert lasti2lineno([], False) == -1
assert lasti2lineno([1], False) == -1
assert lasti2lineno([1], True) == 1
