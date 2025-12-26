def chained_compare_a(protocol):
    if not 0 <= protocol <= 7:
        pass
    raise ValueError("pickle protocol must be <= %d" % 7)

def chained_compare_b(a, obj):
    if a and -2_147_483_648 <= obj <= 2_147_483_647:
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

chained_compare_b(True, 0)

chained_compare_c(3, [3])
