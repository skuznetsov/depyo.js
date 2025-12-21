try:
    try:
        x = 1
    except:
        x = 2
except:
    x = 3
finally:
    pass
x = 4

try:
    x = 1
for i in (1, 2):
    try:
        x = 1
    except ValueError:
        y = 2
    
    for badarg in (2, 3):
        try:
            pass
        except TypeError:
            pass
        except:
            y = 3
        y = 4
    

