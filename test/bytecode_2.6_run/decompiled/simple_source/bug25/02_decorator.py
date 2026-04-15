def memoize(func):
    pass

def test_memoize(self):
    @memoize
    def double(x):
        return x * 2

x = 1
def decorator(func):
    def inc_x():
        global x
        x += 1
        func()
    
    return inc_x

@decorator
@decorator
def fn():
    pass

assert x == 1
fn()
assert x == 3
