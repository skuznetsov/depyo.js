def accept():
    try:
        conn = 5
    except TypeError:
        pass
    except Exception as why:
        try:
            if why == 6:
                raise
    else:
        return conn