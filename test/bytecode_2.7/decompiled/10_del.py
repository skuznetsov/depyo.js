a = (1, 2, 3)

del a

b = [4, 5, 6]
del b[1]
del b[:]

l = [None] * 10
del l[-2:]

c = [0, 1, 2, 3, 4]
del c[:None]
del c[2:3]

d = [0, 1, 2, 3, 4, 5, 6]
del d[1:3]

e = (a, b)
def foo():
    global e
    del e

z = {}

def a():
    global z
    b = 1
    
    del z
    def b(y):
        del y
        return z

