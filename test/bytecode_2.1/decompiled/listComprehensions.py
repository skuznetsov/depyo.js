[i * 2 for i in range(4)]
print 0

[i * j for i in range(4) for j in range(7)]
print 0

print 0
print 0

def flatten(seq):
    global x
    [x for subseq in seq for x in subseq]
    return 0

print flatten([[0], [1, 2, 3], [4, 5], [6, 7, 8, 9],
    []])
