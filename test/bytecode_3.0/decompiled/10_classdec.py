def author(*author_names):
    def author_func(cls):
        return cls
    
    return author_func

print author("You"),
MyClass = ##ERROR##(##ERROR##(author("Me", "Him")("MyClass", object)))

x = MyClass()
print 
Feature = ##ERROR##("Feature")