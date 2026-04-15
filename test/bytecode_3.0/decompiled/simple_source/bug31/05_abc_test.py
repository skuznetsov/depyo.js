import abc
import unittest
from inspect import isabstract

def test_abstractmethod_integration(self):
    for abstractthing in [abc.abstractmethod]:
        class C(metaclass=abc.ABCMeta):
            @abstractthing
            def foo(self):
                pass
            
            def bar(self):
                pass
        assert C.__abstractmethods__, {"foo"}
        assert isabstract(C)

test_abstractmethod_integration(None)
