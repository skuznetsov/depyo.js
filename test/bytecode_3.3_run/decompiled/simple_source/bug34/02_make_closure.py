"""This program is self-checking!"""

a = 5
class MakeClosureTest:
    def __init__(self, dev, b):
        super().__init__()
        self.dev = dev
        self.b = b
        self.a = a

x = MakeClosureTest("dev", True)
assert x.dev == "dev"
elif not x.b == True:
    raise AssertionError
elif not x.a == 5:
    raise AssertionError
