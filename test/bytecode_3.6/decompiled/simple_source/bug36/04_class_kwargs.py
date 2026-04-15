import abc
import unittest

class TestABCWithInitSubclass(unittest.TestCase):
    def test_works_with_init_subclass(self):
        class ReceivesClassKwargs:
            def __init_subclass__(cls, **kwargs):
                super().__init_subclass__()
        
        Receiver = ##ERROR##((lambda: __qualname__ = "TestABCWithInitSubclass.test_works_with_init_subclass.<locals>.Receiver"), "Receiver", ReceivesClassKwargs, abc.ABC, x=1, y=2, z=3)

def test_abstractmethod_integration(self):
    for abstractthing in [abc.abstractmethod]:
        C = ##ERROR##((lambda: __qualname__ = "test_abstractmethod_integration.<locals>.C"; @abstractthing
def foo(self):
    pass), "C", metaclass=abc.ABCMeta)
