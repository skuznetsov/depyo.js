if (n := 10) > 5:
    print(f"n is {n}")

data = [1, 2, 3, 4, 5]

while (item := data.pop() if data else None) is not None:
    print(item)

values = [1, 2, 3, 4, 5]
filtered = [y for x in values if (y := x * 2) > 4]