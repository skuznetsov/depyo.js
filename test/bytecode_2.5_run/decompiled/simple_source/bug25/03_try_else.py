def do_test(method):
    if method == "GET":
        rc = 0
    
    elif method == "POST":
        rc = 1
    
    else:
        raise ValueError, "unknown method: %s" % method
    try:
        rc = 2
    except ZeroDivisionError:
        pass
    
    return rc

assert 2 == do_test("GET")
