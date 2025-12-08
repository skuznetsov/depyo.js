import os
import posixpath

def filter(names, pat):
    result = []
    pat = os.path.normcase(pat)
    match = _compile_pattern(pat, isinstance(pat, bytes))
    
    if os.path is posixpath:
        for name in names:
            if match(name):
                result.append(name)
    
    for name in names:
        if match(os.path.normcase(name)):
            result.append(name)