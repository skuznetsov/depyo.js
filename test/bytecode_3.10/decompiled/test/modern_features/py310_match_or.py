def classify(x):
    match x:
        case 1 | 2:
            return "small"
        case 3 | 4 | 5 if x % 2 == 1:
            return "mid-odd"
        case 3 | 4 | 5:
            return "mid"
        case _ as other:
            return f"other:{other}"

