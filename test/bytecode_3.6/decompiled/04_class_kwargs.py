import abc
import unittest

class TestABCWithInitSubclass(unittest.TestCase):
    def test_works_with_init_subclass(self):
        class ReceivesClassKwargs:
            def __init_subclass__(cls=(__class__), **kwargs):
                super().__init_subclass__()
        
        Receiver = ##ERROR##((lambda: __qualname__ = "TestABCWithInitSubclass.test_works_with_init_subclass.<locals>.Receiver"), "Receiver", ReceivesClassKwargs, abc.ABC, 1, 2, 3, **(x, y, z))

def test_abstractmethod_integration(self):
    for C in [abc.abstractmethod]:
        abstractthing