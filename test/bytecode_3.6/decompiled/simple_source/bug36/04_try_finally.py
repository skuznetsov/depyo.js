def getvalue(self):
    try:
        return 3
    finally:
        return 1

def getvalue1(self):
    try:
        return 4
    finally:
        pass
    
    return 2

def handle_read(self):
    try:
        data = 5
    except ZeroDivisionError:
        return
    except OSError as why:
        return why
    except OSError as why:
        return why
    
    return data

def __exit__(self, type, value, traceback):
    try:
        value()
    except StopIteration as exc:
        try:
            return exc
        finally:
            exc = None
            del exc
    except RuntimeError as exc:
        try:
            return exc
        finally:
            exc = None
            del exc
