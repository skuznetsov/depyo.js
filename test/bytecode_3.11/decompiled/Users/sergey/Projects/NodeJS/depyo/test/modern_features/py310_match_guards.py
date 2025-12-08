def categorize(x):
    match x:
        case int(n) if n < 0:
            return "negative"
        case int(n) if n == 0:
            return "zero"
        case int(n) if n > 0:
            return "positive"
        case _:
            return "not an int"
