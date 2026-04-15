try:
    x = 1
except:
    pass
try:
    x = 1
except ImportError:
    pass
try:
    x = 2
except ImportError:
    x = 3
finally:
    pass
x = 4

try:
    x = 1
except ImportError as e:
    try:
        x = 2
    finally:
        pass
    e = None
    del e
