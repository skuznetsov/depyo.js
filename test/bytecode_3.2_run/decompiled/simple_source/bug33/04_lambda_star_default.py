def pack(width, data):
    return (width, data)

packs = {(lambda: pack(width, data)): w for w in (1, 2, 4)}

assert packs[1]("a") == (1, ("a"))
assert packs[2]("b") == (2, ("b"))
assert packs[4]("c") == (4, ("c"))
