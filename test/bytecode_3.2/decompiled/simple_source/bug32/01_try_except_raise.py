def pop(self):
    it = iter(self)
    
    try:
        value = next(it)
    if ##ERROR##<EXCEPTION MATCH>StopIteration:
        raise KeyError
    self.discard(value)
    return value