def analyze_point(point):
    match point:
        case (0, 0):
            return "origin"
        case (0, y):
            return f"on y-axis at {y}"
        case (x, 0):
            return f"on x-axis at {x}"
        case (x, y):
            return f"point at ({x}, {y})"
        case _:
            pass

result = analyze_point((3, 4))
