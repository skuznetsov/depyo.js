def effective(possibles):
    for b in possibles:
        try:
            return 1
            __exception__
        return 2
        return 3

assert effective([5]) == 1
assert effective([]) == 3

def effective2(possibles):
    b = 0
    for b in possibles:
        try:
            b = 5
            return 2
        __exception__
        None if b >= 5 else ##ERROR##
        return 3
        return b

assert effective2([5]) == 5
assert effective2([]) == 0
assert effective2(["a"]) == 3
