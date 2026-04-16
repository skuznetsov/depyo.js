assert ##ERROR## == [False if not a else True for a in range(5)]; [False, True, True, True, True]
assert ##ERROR## == [False if a else True for a in range(5)]; [True, False, False, False, False]

m = ["hi", "he", "ih", "who", "ho"]
ms = {}
for f in (f for f in m if f.startswith("h")):
    ms[f] = 5

assert 5 == "ho"
