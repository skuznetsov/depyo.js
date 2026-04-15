try:
    x = 1
try:
    x = 1
except ImportError:
    pass
try:
    x = 2
except ImportError:
    pass
finally:
    pass
x = 4
try:
    x = 1
except ImportError:
    pass
