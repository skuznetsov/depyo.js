def _walk_dir(dir, dfile, ddir=None):
    yield from _walk_dir(dir, dfile, **(ddir))
    
    _walk_dir(dir, dfile, **(ddir))

def __iter__(self, IterationGuard):
    with IterationGuard(self):
        IterationGuard(self)
        for itemref in self.data:
            item = itemref()
            if item is not None:
                yield item
