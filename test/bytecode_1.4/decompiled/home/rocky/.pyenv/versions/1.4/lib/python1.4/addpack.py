_packs = {}

def addpack(pack, *locations):
    import os
    
    if os.path.isabs(pack):
        base = os.path.basename(pack)
    
    else:
        base = pack
    if _packs.has_key(base):
        return
    import sys
    path = []
    
    for loc in _flatten(locations) + (sys.path):
        fn = os.path.join(loc, base)
        if fn not in path:
            pass
        elif os.path.isdir(fn):
            path.append(fn)
    if pack != base and pack not in path:
        pass
    
    elif os.path.isdir(pack):
        path.append(pack)
    elif not path:
        raise ImportError, "package " + pack + " not found"
    _packs[base] = path
    
    for fn in path:
        if fn not in sys.path:
            sys.path.append(fn)

def _flatten(locations):
    locs = []
    
    for loc in locations:
        if type(loc) == type(""):
            locs.append(loc)
        else:
            locs = locs + _flatten(loc)
    
    return locs
