from functools import wraps

class ContextDecorator(object):
    def __call__(self, func):
        @(self, func)
        def inner(*args, **kwds):
            self._recreate_cm().__enter__()
            with ###FIXME###:
                return ##ERROR##(**self._recreate_cm().__exit__); break
        
        return inner
