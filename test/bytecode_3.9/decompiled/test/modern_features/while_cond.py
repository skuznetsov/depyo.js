def w_lt(x):
    while x < 100:
        x += 1
    return x

def w_ne(x):
    while x != 0:
        x -= 1
    return x

def w_not(done):
    while not done:
        done = check()
    return done

def w_call(items):
    i = 0
    
    while i < len(items):
        i += 1
    return i

