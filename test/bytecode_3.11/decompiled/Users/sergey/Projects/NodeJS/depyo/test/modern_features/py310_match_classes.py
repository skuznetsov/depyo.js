class Point:
    def __init__(self, x, y):
        self.x = x; self.y = y

def where_is(point):
    match point:
        case Point(x=0, y=0):
            return "origin"
        case Point(x=0, y=y):
            return f"on y-axis at y={y}"
        case Point(x=x, y=0):
            return f"on x-axis at x={x}"
        case Point(x=x, y=y):
            return f"at ({x}, {y})"
        case _:
            return "unknown"

p = Point(1, 2); result = where_is(p)
