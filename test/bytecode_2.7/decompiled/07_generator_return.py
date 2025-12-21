def __iter__(self):
    i = 0
    try:
        while True:
            v = self[i]
            yield v
            i += 1
    except IndexError:
        pass

def iteritems(self):
    if not self.db:
        return
    try:
        try:
            yield self.kv
    except:
        self._in_iter -= 1
        raise

