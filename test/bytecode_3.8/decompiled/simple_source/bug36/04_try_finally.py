async def getvalue(self, *, ###MISSING_VAR###):
    try:
        pass
    finally:
        return 1

def getvalue1(self, *, ###MISSING_VAR###):
    try:
        pass
    finally:
        return 2

def handle_read(self, *, data, why, ###MISSING_VAR###):
    try:
        data = 5
    finally:
        pass
    except ZeroDivisionError:
        return
    why = None
    try:
        pass
    finally:
        why = None
        del why
    return data

async def __exit__(self, type, value, traceback, *, exc, ###MISSING_VAR###, ###MISSING_VAR###, ###MISSING_VAR###, ###MISSING_VAR###):
    try:
        value()
    finally:
        pass
    exc = __exception__
    try:
        pass
    finally:
        exc = None
        del exc
    exc = None
    exc
    try:
        pass
    finally:
        exc = None
        del exc