# depyo issue #14: bottom-tested `while True:` nested in a `for`.
def f(n):
    total = 0
    for i in range(3):
        x = 0
        while True:
            x = x + 1
            if x > n:
                break
        total = total + x
    return total
