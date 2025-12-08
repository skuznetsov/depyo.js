def pop(self):
    it = iter(self)
    
    try:
        value = next(it)
    except:
        raise KeyError
    self.discard(value)
    return value