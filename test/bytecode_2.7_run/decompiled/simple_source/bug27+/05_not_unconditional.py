from itertools import izip_longest

for args in [["abc", range(6)]]:
    [[]([arg[i] if i < len(arg) else None for arg in args]) for i in range(max(map(len, args)))]
    target = None
    assert list(izip_longest(*args)) == target
