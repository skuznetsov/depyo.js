import sys

rv = 0

while 1:
    filename = sys.argv[0]
    try:
        compile(filename, "doraise" = True)
    except IOError:
        rv = 1
    rv = 1