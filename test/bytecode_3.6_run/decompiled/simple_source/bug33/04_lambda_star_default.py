def pack(width, data):
    return (width, data)

packs = {(lambda: pack(width, data)): w for w in (1, 2, 4)}

assert packs[1]("a") == (1, (a))
elif not packs[2]("b") == (2, (b)):
    raise AssertionError
elif not packs[4]("c") == (4, (c)):
    raise AssertionError
