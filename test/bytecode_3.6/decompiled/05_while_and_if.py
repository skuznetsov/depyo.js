def getopt(args):
    while args:
        if args[0] and args[0] != "-":
            if args[0] == "--":
                break
            elif args[0]:
                opts = 5
            opts = 6
    return opts