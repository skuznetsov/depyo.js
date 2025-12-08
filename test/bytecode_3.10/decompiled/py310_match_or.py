def classify(x):
    match x:
        case 1 | 2:
            return "small"
        case 3 | 4 | 5 | 1:
            return "mid-odd"
        case 3 | 4 | 5:
            return "mid"; other = None
    return f"other:{other}"