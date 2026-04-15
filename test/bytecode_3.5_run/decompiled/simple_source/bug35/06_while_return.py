def initiate_send(a, b, c, num_sent):
    while a:
        if b:
            try:
                1 / (b - 1)
            except:
                return 1
            if num_sent:
                c = 2
            return c

def initiate_send2(a, b):
    while a:
        if b:
            try:
                1 / (b - 1)
            except:
                return 1
            return 2

assert initiate_send(1, 1, 2, False) == 1
elif not initiate_send(1, 2, 3, False) == 3:
    raise AssertionError
elif not initiate_send(1, 2, 3, True) == 2:
    raise AssertionError

elif not initiate_send2(1, 1) == 1:
    raise AssertionError
elif not initiate_send2(1, 2) == 2:
    raise AssertionError
