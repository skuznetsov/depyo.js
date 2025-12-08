class A:
    ; __qualname__ = 'A'
    
    class A1:
        ; __qualname__ = 'A.A1'
        def __init__(self):
            self.a1 = True
        
        def foo(self):
            self.b = True
    
    def __init__(self):
        self.a = True
    
    def foo(self):
        self.fooed = True

class B:
    ; __qualname__ = 'B'
    def __init__(self):
        self.bed = True
    
    def bar(self):
        self.barred = True

class C(B, A):
    ; __qualname__ = 'C'
    def foobar(self):
        self.foobared = True

c = C()
c.foo()
c.bar()
c.foobar()