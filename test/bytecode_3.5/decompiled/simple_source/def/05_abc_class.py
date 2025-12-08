class abstractclassmethod(classmethod):
    ; __qualname__ = 'abstractclassmethod'
    __isabstractmethod__ = True
    
    def __init__(self, callable):
        callable.__isabstractmethod__ = True
        super().__init__(callable)