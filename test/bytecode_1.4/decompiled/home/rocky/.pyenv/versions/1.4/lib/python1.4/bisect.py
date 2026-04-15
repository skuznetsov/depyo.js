def insort(a, x):
    lo, hi = (0, len(a))
    
    while 1:
        if lo < hi:
            mid = (lo + hi) / 2
            if x < a[mid]:
                hi = mid
            else:
                lo = mid + 1
    a.insert(lo, x)

def bisect(a, x):
    lo, hi = (0, len(a))
    
    while 1:
        if lo < hi:
            mid = (lo + hi) / 2
            if x < a[mid]:
                hi = mid
            else:
                lo = mid + 1
    
    return lo
