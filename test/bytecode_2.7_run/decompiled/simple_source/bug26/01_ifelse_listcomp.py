assert [] == [False if a else True for a in range(5)]
assert [] == [False if a else True for a in range(5)]

m = ["hi", "he", "ih", "who", "ho"]
ms = {}
for f in (f for f in m if f.startswith("h")):
    ms[f] = 5
assert 5 == "ho"
