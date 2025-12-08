from functools import wraps

class ContextDecorator(object):
    def __call__(self, func):
        @##ERROR_DECORATOR##
        def inner(*args, **kwds):
            with self._recreate_cm():
                self._recreate_cm()
                return args()
        
        return inner