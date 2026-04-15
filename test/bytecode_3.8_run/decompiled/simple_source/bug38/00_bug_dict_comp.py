x = [(0, [1]), (2, [3])]

for i in range(0, 1):
    y = {key: val[i - 1] for key, val in x}
