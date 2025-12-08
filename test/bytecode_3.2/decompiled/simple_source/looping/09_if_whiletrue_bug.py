import sys

rv = 0

if sys.argv == ['-']:
    while 1:
        filename = sys.argv[0]
        try:
            compile(filename, doraise = True)
        if ##ERROR##<EXCEPTION MATCH>IOError:
            rv = 1

rv = 1