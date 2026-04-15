def CFUNCTYPE(argtypes):
    class CFunctionType(argtypes):
        _argtypes_ = argtypes
    
    return CFunctionType
