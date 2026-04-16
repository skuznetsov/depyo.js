from itertools import izip_longest

for args in [["abc", range(6)]]:
    target = [tuple([arg[i] if i < len(arg) else None for arg in args]) for i in range(max(map(len, args)))]
    assert list(izip_longest(*args)) == target

