ary = [1, 2, 3, 4, 5]

a = ary[:2]
assert a == [1, 2]

a = ary[2:]
assert a == [3, 4, 5]

a = ary[1:4]
assert a == [2, 4]
