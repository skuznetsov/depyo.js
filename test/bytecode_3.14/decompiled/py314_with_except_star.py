def with_except_star(val):
    try:
        with open("file") as f:
            data = f.read()
        return data
    except* OSError as e:
        data = str(e)
    return data
