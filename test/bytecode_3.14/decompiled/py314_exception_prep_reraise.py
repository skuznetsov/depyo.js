def split_group():
    try:
        raise ExceptionGroup("eg", [ValueError("a"), TypeError("b")])
    except* ValueError as e:
        note = str(e)
    return note
