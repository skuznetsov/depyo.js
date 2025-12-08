try:
    try:
        x = 1
    except:
        x = 2
except:
    x = 3
finally:
    x = 4

try:
    x = 1
except:
    x = 2
x = 3