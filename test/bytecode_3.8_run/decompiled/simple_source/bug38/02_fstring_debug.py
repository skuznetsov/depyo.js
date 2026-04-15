{f"3.1415={3.1415:.1f}":*^20} == "*****3.1415=3.1*****"

y = 2
def f(x, width):
    return f"x={x * y:{width}}"

x = "bar"

x = "A string"
f"{x=}" == "x=" + repr(x)

pi = "π"

x = 20
