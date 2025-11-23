def analyze_point(point):
    match point:
        case (0, 0) if len(point) == 2:
            return "origin"
        case (0, y) if len(##ERROR##) == 2:
            return f"on y-axis at {y}"
        case (0, x) if len(##ERROR##) == 2:
            return f"on x-axis at {x}"; return f"point at ({x}, {y})"
        case (x, y) if len(##ERROR##) == 2:
            pass

result = analyze_point((3, 4))