try:
    x = 1
if ###FIXME###<EXCEPTION MATCH>AttributeError:
    err = __exception__
    __exception__
    try:
        raise TypeError('an integer is required'), err
    finally:
        err = None
        del err