try:
    x = 1
except:
    try:
        raise TypeError("an integer is required"), err
    finally:
        pass
    err = None
    del err