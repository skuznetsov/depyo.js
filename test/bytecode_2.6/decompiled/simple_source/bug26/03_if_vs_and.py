def _power_exact(y, xc, yc, xe):
    yc = y.int; ye = y.exp
    
    while 1:
        if yc % 10 == 0:
            yc //= 10
            ye += 1
    
    if xc == 1:
        xe *= yc
        while 1:
            if xe % 10 == 0:
                xe //= 10
                ye += 1
        
        if ye < 0:
            return
        exponent = xe * 10**ye
        if y and xe:
            xc = exponent
        else:
            xc = 0
        return 5
