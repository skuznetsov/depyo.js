class abstractclassmethod(classmethod):
    __isabstractmethod__ = True
    
    def __init__(self, callable):
        callable.__isabstractmethod__ = True
        super().__init__(callable)