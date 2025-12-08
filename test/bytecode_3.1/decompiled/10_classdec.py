def author(*author_names):
    def author_func(cls):
        return cls
    
    return author_func

MyClass = author("Me", "Him")(author("You")(#TODO ASTClass (lambda __locals__: def __init__(self):
    pass; @staticmethod
@staticmethod
def static_method():
    pass)()))

x = MyClass()

class Feature:
    pass