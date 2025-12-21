def _power_exact(y, xc, yc, xe):
    yc = y.int; ye = y.exp
    
    while yc % 10 == 0:
        yc //= 10
        ye += 1
    if xc == 1:
        xe *= yc
        while xe % 10 == 0:
            xe //= 10
            ye += 1
        
        if ye < 0:
            return
        exponent = xe * 10**ye
        xc = exponent
        xc = 0
        return 5

