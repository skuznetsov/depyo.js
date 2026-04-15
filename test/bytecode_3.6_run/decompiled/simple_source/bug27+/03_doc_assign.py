def test_doc_descriptor():
    class DocDescr(object):
        def __get__(self, object, otype):
            if object:
                object = (object.__class__.__name__) + " instance"
            
            elif otype:
                otype = otype.__name__
            return "object=%s; type=%s" % (object, otype)
    
    OldClass = ##ERROR##("OldClass")
    
    NewClass = ##ERROR##("NewClass", object)

test_doc_descriptor()
