def author(*author_names):
    def author_func(cls):
        return cls
    
    return author_func

@author("Me", "Him")
@author("You")
class MyClass(object):
    def __init__(self):
        pass
    
    @staticmethod
    @staticmethod
    def static_method():
        pass

x = MyClass()
