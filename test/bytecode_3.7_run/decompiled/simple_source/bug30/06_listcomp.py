def _format(node):
    return [(a, int(b)) for a, b in node.items()]

x = {"a": "1", "b": "2"}
assert [(a, 1), (b, 2)] == _format(x)

def monthrange(ary, dotext):
    return [a[3:] for a in ary if a.startswith(dotext)]

ary = ["Monday", "Twoday", "Monmonth"]
assert ["day", "month"] == monthrange(ary, "Mon")

def columnize(l):
    return [i for i in range(len(l)) if isinstance(l[i], str)]

assert [0, 2] == columnize([1, "a", 2])

def count(values, x):
    return sum((1 for v in values if x))

assert count([2, 2], False) == 2
assert count([], False) == 0
assert count([], True) == 0
assert count([2], True) == 1
assert count([0], False) == 0

def init_board(c):
    return ##ERROR##[io]

assert init_board(list(range(6))) == [3, 4]
