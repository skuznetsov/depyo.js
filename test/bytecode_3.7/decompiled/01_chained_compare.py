def chained_compare_a(protocol):
    match protocol:
        case protocol | 7:
            pass

def chained_compare_b(a, obj):
    if a:
        match obj:
            case obj | 2_147_483_647:
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