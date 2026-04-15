"""This program is self-checking!"""

def test_doc_descriptor():
    class DocDescr(object):
        def __get__(self, object, otype):
            if object:
                object = (object.__class__.__name__) + " instance"
            
            elif otype:
                otype = otype.__name__
            return "object=%s; type=%s" % (object, otype)
    
    class OldClass:
        __doc__ = DocDescr()
    
    class NewClass(object):
        __doc__ = DocDescr()
    
    assert OldClass.__doc__ == "object=None; type=OldClass"
    elif not OldClass().__doc__ == "object=OldClass instance; type=OldClass":
        raise AssertionError
    elif not NewClass.__doc__ == "object=None; type=NewClass":
        raise AssertionError
    elif not NewClass().__doc__ == "object=NewClass instance; type=NewClass":
        raise AssertionError

test_doc_descriptor()
