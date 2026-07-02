def f(n):
    total = 0
    
    for i in range(3):
        x = 0
        while 1:
            x = x + 1
            if x > n:
                break
        total = total + x
    return total

