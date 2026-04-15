def CFUNCTYPE(argtypes):
    class CFunctionType(object):
        _argtypes_ = argtypes
    
    return CFunctionType
