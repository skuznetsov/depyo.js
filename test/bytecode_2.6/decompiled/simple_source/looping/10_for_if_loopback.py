def _slotnames(cls):
    names = []
    for c in cls.__mro__:
        if "__slots__" in c.__dict__:
            slots = c.__dict__["__slots__"]
            for name in slots:
                if name == "__dict__":
                    continue
                names.append(name)
            
