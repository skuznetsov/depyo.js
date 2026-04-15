def initiate_send(a, b, c, num_sent):
    while a:
        if b:
            try:
                1 / (b - 1)
            except ZeroDivisionError:
                pass
            if num_sent:
                c = 2
            return c

def initiate_send2(a, b):
    while a:
        if b:
            try:
                1 / (b - 1)
            except ZeroDivisionError:
                pass
            return 2

assert initiate_send(1, 1, 2, False) == 1
assert initiate_send(1, 2, 3, False) == 3
assert initiate_send(1, 2, 3, True) == 2

assert initiate_send2(1, 1) == 1
assert initiate_send2(1, 2) == 2
