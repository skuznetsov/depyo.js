def test_literal(x):
    match x:
        case 1:
            return "one"
        case 2:
            return "two"
        case _:
            return "other"

def test_capture(x):
    value = x
    return value * 2

def test_sequence(point):
    match point:
        case (x, y):
            return x + y
        case _:
            return 0