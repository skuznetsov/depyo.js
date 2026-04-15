"""This program is self-checking!"""
def scan(items):
    for i in items:
        try:
            5 / i
        break
    
    return i

assert scan((0, 1)) == 1
assert scan((0, 0)) == 2
assert scan((3, 2, 1)) == 3
