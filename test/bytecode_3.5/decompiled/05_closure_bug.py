from functools import wraps

def contextmanager(func):
    @(func)
    def helper(*args, **kwds):
        return _GeneratorContextManager(func, *args, **kwds)
    
    return helper

