for package in [1, 2]:
    try:
        pass
    except IndexError:
        with __file__ as f:
            pass
    
    raise
