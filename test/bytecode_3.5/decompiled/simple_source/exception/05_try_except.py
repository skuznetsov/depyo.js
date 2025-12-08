def handle(module):
    try:
        module = 1
    if ###FIXME###<EXCEPTION MATCH>ImportError:
        exc = __exception__
        __exception__
        try:
            module = exc
        finally:
            exc = None
            del exc
    return module

def handle2(module):
    if module == 'foo':
        try:
            module = 1
        if ###FIXME###<EXCEPTION MATCH>ImportError:
            exc = __exception__
            __exception__
            try:
                module = exc
            finally:
                exc = None
                del exc
    return module

try:
    pass
if ###FIXME###<EXCEPTION MATCH>ImportError:
    exc = __exception__
    __exception__
    try:
        pass
    finally:
        exc = None
        del exc
finally:
    y = 1