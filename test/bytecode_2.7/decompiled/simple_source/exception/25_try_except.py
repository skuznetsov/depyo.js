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
for i in (1, 2):
    try:
        x = 1
    except ValueError:
        y = 2
    

for badarg in (2, 3):
    try:
        pass
    except TypeError:
        y = 3
    except ValueError:
        pass
    else:
        y = 4
