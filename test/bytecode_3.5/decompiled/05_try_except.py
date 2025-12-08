def handle(module):
    try:
        module = 1
    except:
        try:
            module = exc
        finally:
            pass
        exc = None
        del exc
    return module

def handle2(module):
    if module == "foo":
        try:
            module = 1
        except:
            try:
                module = exc
            finally:
                pass
            exc = None
            del exc
    return module

try:
    pass
except:
    try:
        pass
    finally:
        pass
    exc = None
    del exc
finally:
    pass
y = 1