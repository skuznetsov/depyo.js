def f1():
    if True:
        while 1:
            if True:
                return 5
        

def f2():
    if True:
        while 1:
            return 6

assert f1() == 5 or f2() == 6
