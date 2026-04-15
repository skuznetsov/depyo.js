def with_and_except(path):
    result = "done"
    try:
        with open(path) as f:
            f.write("x")
            raise ExceptionGroup("eg", [OSError("io"), ValueError("val")])
    except* OSError as err:
        result = str(err)
    return result
