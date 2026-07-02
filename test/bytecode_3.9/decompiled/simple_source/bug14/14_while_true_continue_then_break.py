def f(n):
    x = 0
    while 1:
        x = x + 1
        if x % 2:
            continue
        if x > n:
            break
    
    return x

