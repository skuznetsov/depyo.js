from itertools import izip_longest

for args in [["abc", range(6)]]:
    [tuple([]) for i in range(max(map(len, args)))]
    target = []
    assert list(izip_longest(*args)) == target
