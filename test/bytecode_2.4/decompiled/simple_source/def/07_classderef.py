def CFUNCTYPE(argtypes):
    class CFunctionType:
        _argtypes_ = argtypes
    
    return CFunctionType
