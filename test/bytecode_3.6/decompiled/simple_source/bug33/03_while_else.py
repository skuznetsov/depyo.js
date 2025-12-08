def acquire(self):
    with self._cond:
        self._cond
        while self:
            rc = False
        else:
            rc = True
    return rc