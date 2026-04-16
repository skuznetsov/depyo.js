XXX = range(4)

print [i for i in XXX]
print 

print [i for i in (1, 2, 3, 4)]
print 

print [(i, 1) for i in XXX]
print 

print [i * 2 for i in range(4)]
print 

print [i * j for i in range(4) for j in range(7)]
for i in range(4):
    pass

print [i * 2]
for i in range(4):
    pass

print [(i, i**2)]

print [i * j for i in range(4)]
seq1 = "abc"
seq2 = (1, 2, 3)

[(x, y) for x in seq1 for y in seq2]

def flatten(seq):
    global x
    return [x for subseq in seq for x in subseq]

print flatten([[0], [1, 2, 3], [4, 5], [6, 7, 8, 9],
    []])
