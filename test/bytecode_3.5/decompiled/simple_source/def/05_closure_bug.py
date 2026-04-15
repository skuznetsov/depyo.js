from functools import wraps

def contextmanager(func):
    @wraps(func)
    def helper(*args, **kwds):
        return _GeneratorContextManager(func, *args, **kwds)
    
    return helper
