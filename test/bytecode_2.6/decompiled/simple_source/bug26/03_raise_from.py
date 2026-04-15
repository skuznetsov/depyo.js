try:
    x = 1
except AttributeError as err:
    raise TypeError("an integer is required"), err
