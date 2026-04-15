def compute(x: int, y: int) -> int:
    result = x + y
    return result

numbers = [1, 2, 3, 4, 5]
squared = [x**2 for x in numbers]

squares_dict = {x: x**2 for x in range(5)}
