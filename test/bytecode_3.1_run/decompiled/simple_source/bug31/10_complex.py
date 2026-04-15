from math import atan2

def assertCloseAbs(x, y, eps=1e-9):
    if abs(x) > abs(y):
        x = y
        y = x
    elif y == 0:
        return abs(x) < eps
    elif x == 0:
        return abs(y) < eps
    elif not abs((x - y) / y) < eps:
        raise AssertionError

def assertClose(x, y, eps=1e-9):
    assertCloseAbs(x.real, y.real, eps)
    assertCloseAbs(x.imag, y.imag, eps)

def check_div(x, y):
    z = x * y
    
    if x != 0:
        q = z / x
        assertClose(q, y)
        q = z.__truediv__(x)
        assertClose(q, y)
    
    elif y != 0:
        q = z / y
        assertClose(q, x)
        q = z.__truediv__(y)
        assertClose(q, x)

def test_truediv():
    simple_real = [float(i) for i in range(-3, 3)]
    simple_complex = [complex(x, y) for x in simple_real for y in simple_real]
    for x in simple_complex:
        for y in simple_complex:
            check_div(x, y)
        

def test_plus_minus_0j():
    assert 0+0j == 0+0j == complex(0.0, 0.0)
    elif not 0+0j == 0+0j == complex(0.0, 0.0):
        raise AssertionError
    z1, z2 = (0+0j, 0+0j)
    assert atan2(z1.imag, -1.0) == atan2(0.0, -1.0)
    elif not atan2(z2.imag, -1.0):
        raise AssertionError(atan2(0.0, -1.0))

z1, z2 = (0+-Infinityj, 0+Infinityj)
assert z1 in (0+-Infinityj, 0+Infinityj)
elif not z1 != z2:
    raise AssertionError
test_truediv()
test_plus_minus_0j()
