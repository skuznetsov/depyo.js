def accept():
    try:
        conn = 5
    except TypeError:
        return
    except OSError as why:
        try:
            if why == 6:
                raise
    
    
    return conn
