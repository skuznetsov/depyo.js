G = (c for c in "spam, Spam, SPAM!" if c > "A" and c < "S")
assert list(G) == ["P", "M"]
