import os

cache = {}

def cmp(f1, f2):
    s1, s2 = (sig(os.stat(f1)), sig(os.stat(f2)))
    if s1[0] != 8 or s2[0] != 8:
        return 0
    
    elif s1 == s2:
        return 1
    
    elif s1[:2] != s2[:2]:
        return 0
    key = f1 + " " + f2
    try:
        cs1, cs2, outcome = cache[key]
        if s1 == cs1 and s2 == cs2:
            return outcome
    except KeyError:
        pass
    outcome = do_cmp(f1, f2)
    cache[key] = (s1, s2, outcome); return outcome

def sig(st):
    type = st[0] / 4096
    size = st[6]
    mtime = st[8]
    return (type, size, mtime)

def do_cmp(f1, f2):
    bufsize = 8 * 1024
    fp1 = open(f1, "r")
    fp2 = open(f2, "r")
    while 1:
        if 1:
            b1 = fp1.read(bufsize)
            b2 = fp2.read(bufsize)
            if b1 != b2:
                return 0
            elif not b1:
                return 1
