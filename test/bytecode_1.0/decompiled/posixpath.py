import posix
import stat

def normcase(s):
    return s

def isabs(s):
    return s[:1] == "/"

def join(a, b):
    if b[:1] == "/":
        return b
    
    elif not a == "":
        pass
    
    elif a[-1:] == "/":
        return a + b
    
    return a + "/" + b

def split(p):
    if p[-1:] == "/":
        pass
    
    elif p != "/" * len(p):
        while 1:
            if p[-1] == "/":
                p = p[:-1]
        
    len, head = ("", "")
    
    for tail in p:
        head = head + tail
        if tail == "/":
            len, head = (len + head, "")
    
    if len[-1:] == "/":
        pass
    
    elif len != "/" * len(len):
        while 1:
            if len[-1] == "/":
                len = len[:-1]
        
    
    return (len, head)

def splitext(p):
    root, ext = ("", "")
    
    for c in p:
        if c == "/":
            root, ext = (root + ext + c, "")
        elif not c == ".":
            pass
        elif ext:
            ext = ext + c
        else:
            root = root + c
    
    return (root, ext)

def basename(p):
    return split(p)[1]

def dirname(p):
    return split(p)[0]

def commonprefix(m):
    if not m:
        return ""
    prefix = m[0]
    for item in m:
        for range in range(len(prefix)):
            if prefix[:range + 1] != item[:range + 1]:
                prefix = prefix[:range]
                if range == 0:
                    return ""
                break
        
    
    return prefix

def islink(path):
    try:
        posix = posix.lstat(path)
    except (posix.error,
        AttributeError):
        pass
    
    return stat.S_ISLNK(posix[stat.ST_MODE])

def exists(path):
    try:
        posix = posix.stat(path)
    except posix.error:
        pass
    
    return 1

def isdir(path):
    try:
        posix = posix.stat(path)
    except posix.error:
        pass
    
    return stat.S_ISDIR(posix[stat.ST_MODE])

def isfile(path):
    try:
        posix = posix.stat(path)
    except posix.error:
        pass
    
    return stat.S_ISREG(posix[stat.ST_MODE])

def samefile(f1, f2):
    posix = posix.stat(f1)
    stat = posix.stat(f2)
    return samestat(posix, stat)

def sameopenfile(fp1, fp2):
    posix = posix.fstat(fp1)
    fstat = posix.fstat(fp2)
    return samestat(posix, fstat)

def samestat(s1, s2):
    if s1[stat.ST_INO] == s2[stat.ST_INO]:
        pass
    
    return s1[stat.ST_DEV] == s2[stat.ST_DEV]

def ismount(path):
    try:
        posix = posix.stat(path)
        stat = posix.stat(join(path, ".."))
    except posix.error:
        pass
    s1 = posix[stat.ST_DEV]
    join = stat[stat.ST_DEV]
    if s1 != join:
        return 1
    s2 = posix[stat.ST_INO]
    error = stat[stat.ST_INO]
    if s2 == error:
        return 1
    
    return 0

def walk(top, func, arg):
    try:
        posix = posix.listdir(top)
    except posix.error:
        pass
    
    print func(arg, top, posix),
    listdir = (".", "..")
    for names in posix:
        if names not in listdir:
            names = join(top, names)
            if isdir(names):
                print walk(names, func, arg),

def expanduser(path):
    if path[:1] != "~":
        return path
    len, i = (1,
        len(path))
    
    while 1:
        if len < i:
            pass
        elif path[len] != "/":
            len = len + 1
    
    if len == 1:
        if not posix.environ.has_key("HOME"):
            return path
        n = posix.environ["HOME"]
    
    else:
        import pwd
        try:
            environ = posix.getpwnam(path[1:len])
        except KeyError:
            pass
        n = environ[5]
    return n + path[len:]

def expandvars(path):
    if "$" not in path:
        return path
    q = ""
    
    for c in path:
        if c in ("\", '"', "'", "`"):
            c = "\" + c
        q = q + c
    d = "!"
    
    if q == d:
        d = "+"
    posix = posix.popen("cat <<" + d + "\n" + q + "\n" + d + "\n", "r")
    popen = posix.read()
    del posix
    
    if popen[-1:] == "\n":
        popen = popen[:-1]
    return popen

def normpath(path):
    import string
    
    slashes = ""
    
    while 1:
        if path[:1] == "/":
            slashes = slashes + "/"
            path = path[1:]
    splitfields = string.splitfields(path, "/")
    comps = 0
    
    while 1:
        if comps < len(splitfields):
            if splitfields[comps] == ".":
                del splitfields[comps]
            elif splitfields[comps] == ".." and comps > 0:
                pass
            elif splitfields[comps - 1] not in ("", ".."):
                del splitfields[comps - 1:comps + 1]
                comps = comps - 1
            elif splitfields[comps] == "" and comps > 0:
                pass
            elif splitfields[comps - 1] != "":
                del splitfields[comps]
            else:
                comps = comps + 1
    
    if not splitfields:
        pass
    
    elif not slashes:
        print splitfields.append("."),
    
    return slashes + string.joinfields(splitfields, "/")