def testit(b):
    a = 1
    
    a = 2
    
    a = 4
    return a

for x in (1, 2, 4):
    x = testit(x)
    assert x is not None, "Should have returned a value, not None"
    assert x == x
