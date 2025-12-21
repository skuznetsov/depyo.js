def as_completed(fs, *, loop=None):
    todo = {async(f, "loop" = loop) for f in set(fs)}

