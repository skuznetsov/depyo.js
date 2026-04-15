def pop(self):
    it = iter(self)
    
    try:
        value = next(it)
    except StopIteration:
        raise KeyError
    self.discard(value)
    return value
