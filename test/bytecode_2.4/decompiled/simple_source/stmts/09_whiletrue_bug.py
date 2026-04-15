if args == ["-"]:
    while 1:
        if True:
            try:
                compile(filename, "doraise" = True)
            except RuntimeError:
                rv = 1
    
else:
    rv = 1
print rv
