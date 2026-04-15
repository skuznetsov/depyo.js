try:
    try:
        x = 1
    except AssertionError:
        pass
except ImportError:
    pass
finally:
    pass
x = 4

try:
    x = 1
except SystemExit:
    else:
        x = 3
