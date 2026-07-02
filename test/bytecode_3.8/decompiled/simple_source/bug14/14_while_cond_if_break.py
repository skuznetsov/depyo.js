def f(n):
    x = 0
    while x < n:
        x = x + 3
        if x % 7 == 0:
            break
    
    return x

