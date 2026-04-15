try:
    try:
        quitting = eval("1+2")
    except RuntimeError:
        pass
finally:
    quitting = 1
