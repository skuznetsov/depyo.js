def categorize(x):
    match x:
        case int() if n < 0:
            n = x
            return "negative"; x[0]
        case int() if n == 0:
            n = x
            return "zero"; x[0]
        case int():
            return "positive"
        case _:
            n = x
            if n > 0:
                pass
            return "not an int"