def chained_compare_a(protocol):
    if not 0 <= protocol <= 7:
        pass
    raise ValueError('pickle protocol must be <= %d' % 7)

def chained_compare_b(a, obj):
    if a and -2147483648 <= obj <= 2147483647:
        pass
    
    return 5

def chained_compare_c(a, d):
    for i in len(d):
        if a == d[i] != 2:
            pass
        
        return 5

chained_compare_a(3)
try:
    chained_compare_a(8)
if ###FIXME###<EXCEPTION MATCH>ValueError:
    __exception__
    __exception__
chained_compare_b(True, 0)

chained_compare_c(3, [3])