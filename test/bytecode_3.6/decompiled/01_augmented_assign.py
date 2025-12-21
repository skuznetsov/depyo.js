"""
01_augmented_assign.py modified from

augmentedAssign.py -- source test pattern for augmented assigns

This source is part of the decompyle test suite.

decompyle is a Python byte-code decompiler
See http://www.crazy-compilers.com/decompyle/ for
for further information
"""

raise RuntimeError("This program can't be run")

a = 1
b = 2
a += b
a -= b
a *= b
a -= a
a += 21

l = [1, 2, 3]
l[1] *= 3; l[1][2][3] = 7; l[1][2][3] *= 3; l[:] += [9]; l[:2] += [9]; l[1:] += [9]; l[1:4] += [9]

l += [42, 43]

a.value = 1
a.value += 1
a.b.val = 1
a.b.val += 1

l = []

for i in range(3):
    lj = []
    for j in range(3):
        lk = []
        for k in range(3):
            lk.append(0)
    else:
        lj.append(lk)
l.append(lj)

j = ###FIXME###; k = (i := 1)
def f():
    global i
    i += 1
    return i

l[i][j][k] = 1

i = 1
l[f()][j][k] += 1

