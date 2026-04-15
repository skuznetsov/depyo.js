try:
    try:
        x = 1
    except AssertionError:
        x = 2
except ImportError:
    x = 3
finally:
    x = 4

try:
    x = 1
except SystemExit:
    x = 2
except:
    x = 3
