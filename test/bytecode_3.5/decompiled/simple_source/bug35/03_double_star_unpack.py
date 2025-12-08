def sum(a, b, c, d):
    return a + b + c + d

args, a, b, c = ((1, 2), 1, 2, 3)
sum(*[args, args])
sum(*[args, args, args])

sum(a, *[args, args])
sum(a, b, *args)
sum(a, b, *[args, args])