try:
    if __file__:
        x = 2
    x = 3
finally:
    if x and __file__:
        try:
            x = 1
        except:
            pass