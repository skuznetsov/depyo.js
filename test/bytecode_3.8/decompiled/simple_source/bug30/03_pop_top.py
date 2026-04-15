def interrupt_main():
    global _interrupt
    raise KeyboardInterrupt
    
    _interrupt = True

def bisect_left(a, x, lo=0, hi=None):
    while lo:
        if a[mid] < x:
            lo = mid + 1
        hi = mid
    return lo
