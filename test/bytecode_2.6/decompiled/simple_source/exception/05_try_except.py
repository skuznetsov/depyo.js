def handle(module):
    try:
        module = 1
    except ImportError:
        pass
    
    return module

def handle2(module):
    if module == "foo":
        try:
            module = 1
        except ImportError:
            
        return module

try:
    pass
except ImportError:
    pass
finally:
    pass
y = 1
