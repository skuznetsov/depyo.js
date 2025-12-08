def compute(x, y={"x": int, "y": int, "return": int}):
    result = x + y
    return result

numbers = [1, 2, 3, 4, 5]
squared = [x ** 2 for x in numbers]

squares_dict = [x:x ** 2]