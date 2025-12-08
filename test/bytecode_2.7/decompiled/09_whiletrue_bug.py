while True:
    try:
        compile(__file__, "doraise" = True)
    except RuntimeError:
        rv = 1
    
    rv = 1
    print rv
    