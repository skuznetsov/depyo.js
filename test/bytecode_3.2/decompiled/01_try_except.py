try:
    x = 1

try:
    x = 1

try:
    x = 2
except:
    x = 3
finally:
    x = 4

try:
    x = 1
except:
    try:
        x = 2
    finally:
        pass
    e = None
    del e