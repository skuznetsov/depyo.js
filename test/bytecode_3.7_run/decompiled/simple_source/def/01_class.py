class A:
    pass

class B(Exception):
    pass

class MyInt(int):
    class MyInt(int):
        __slots__ = ()
    
    try:
        1.__class__ = MyInt
        assert False, "builtin types don't support __class__ assignment."
