type Point = tuple[float, float]
type Matrix = list[list[float]]

def distance(p1: Point, p2: Point) -> float:
    return ((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)**0.5

point1: Point = (0.0, 0.0)
point2: Point = (3.0, 4.0)
d = distance(point1, point2)
