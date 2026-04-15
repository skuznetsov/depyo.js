def iter(self):
    i = 0
    try:
        while 1:
            v = self[i]
            yield v
            i += 1
    except IndexError:
        return

A = [10, 20, 30]
assert list(iter(A)) == A
