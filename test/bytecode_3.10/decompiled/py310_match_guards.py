def categorize(x):
    match x:
        case int():
            n = x
        case 0:
            return "negative"
        case int():
            n = x
        case 0:
            return "zero"
        case int():
            n = x
            return "positive"
        case 0:
            return "not an int"