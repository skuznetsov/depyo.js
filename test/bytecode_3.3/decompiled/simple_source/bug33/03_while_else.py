def acquire(self):
    with self._cond:
        while self:
            rc = False
        else:
            rc = True
    return rc
