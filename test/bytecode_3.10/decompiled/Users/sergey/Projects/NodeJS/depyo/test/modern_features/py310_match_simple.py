def test_literal(x):
    if x == 1:
        return "one"
    elif x == 2:
        return "two"
    
    return "other"

def test_capture(x):
    value = x
    return value * 2

def test_sequence(point):
    match point:
        case (x, y) if len(point) == 2:
            return 0