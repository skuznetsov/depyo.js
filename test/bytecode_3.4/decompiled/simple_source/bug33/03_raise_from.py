try:
    x = 1
except AttributeError as err:
    try:
        raise TypeError("an integer is required"), err
    finally:
        pass
    err = None
    del err
