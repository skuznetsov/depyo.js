def simple_while(x):
    while x < 100:
        x += 1
    return x


def while_ne(x):
    while x != 0:
        x -= 1
    return x


def while_not(done):
    while not done:
        done = check()
    return done


def while_call(items):
    i = 0
    while i < len(items):
        i += 1
    return i


def while_true_break(x):
    while True:
        x += 1
        if x > 100:
            break
    return x


def while_true_infinite(x):
    while True:
        x += 1
        log(x)
