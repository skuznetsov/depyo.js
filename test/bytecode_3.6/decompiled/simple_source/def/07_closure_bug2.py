from functools import wraps

class ContextDecorator(object):
    def __call__(self, func):
        @wraps(func)
        def inner(*args, **kwds):
            with self._recreate_cm():
                return func(*args, **kwds)
        
        return inner
