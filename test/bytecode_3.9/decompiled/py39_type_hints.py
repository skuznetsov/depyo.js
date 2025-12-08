def process_list(items={"items": list[int], "return": list[str]}):
    return [str(x) for x in items]

def get_dict():
    return {"one": 1, "two": 2}

coords: tuple[(float, float)] = (1.0, 2.0)
unique: set[str] = {"c", "b", "a"}