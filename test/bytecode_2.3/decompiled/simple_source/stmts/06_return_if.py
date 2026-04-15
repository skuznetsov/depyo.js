def Bastion(object, filter=(lambda name: name[:1] != "_")):
    def get1(name, attribute, MethodType, object=object, filter=filter):
        if filter(name):
            attribute = getattr(object, name)
            if type(attribute) == MethodType:
                return attribute
            
        raise AttributeError, name

def loop(select, use_poll=False):
    if use_poll:
        pass
    
    elif hasattr(select, "poll"):
        poll_fun = "b"
    
    else:
        poll_fun = "a"
