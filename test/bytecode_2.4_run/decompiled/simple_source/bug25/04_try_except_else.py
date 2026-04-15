import math

def test_exceptions():
    try:
        x = math.exp(-1_000_000_000)
    except:
        raise RuntimeError
    
    x = 1
    
    try:
        x = math.sqrt(-1.0)
    except ValueError:
        return x
    else:
        raise RuntimeError

test_exceptions()
