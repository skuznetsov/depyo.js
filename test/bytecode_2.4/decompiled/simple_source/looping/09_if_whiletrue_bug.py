import sys

rv = 0
if sys.argv == ["-"]:
    while 1:
        if True:
            filename = sys.argv[0]
            try:
                compile(filename, "doraise" = True)
            except IOError:
                rv = 1
    
else:
    rv = 1
