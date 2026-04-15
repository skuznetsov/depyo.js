def __init__(self, path, name, files=(), dirs=(), volumes=()):
    f = [path.join(dir, filename) for dir in dirs for filename in files]
    
    f2 = [path.join(drive, dir, filename) for dir in dirs for filename in files for drive in volumes]
    return (f, f2)

import __future__

_features = [getattr(__future__, fname) for fname in __future__.all_feature_names]
