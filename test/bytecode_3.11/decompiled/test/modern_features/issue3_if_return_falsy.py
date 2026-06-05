def falsy_x(cond):
    x = 1
    if cond:
        return x
    
    return 0

def none_x(cond):
    if cond:
        return
    
    return "fallback"

def empty_string(cond):
    if cond:
        return ""
    
    return "fallback"

def truthy_x(cond):
    if cond:
        return 42
    
    return 0

def negative_branch(cond):
    if not cond:
        return 1
    
    return 2

def real_short_circuit(cond, x):
    return cond and x