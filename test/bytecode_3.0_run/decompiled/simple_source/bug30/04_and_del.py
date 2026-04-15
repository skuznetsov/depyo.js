def normpath(comps):
    i = 0
    
    while 1:
        if i < len(comps):
            if comps[i] == ".":
                del comps[i]
            elif comps[i] == ".." and i > 0 and comps[i - 1] not in ("", ".."):
                del comps[i - 1:i + 1]
                i = i - 1
            elif comps[i] == "" and i > 0 and comps[i - 1] != "":
                del comps[i]
            i = i + 1
    
    return comps

assert normpath(["."]) == []
assert normpath(["a", "b", ".."]) == ["a"]
assert normpath(["a", "b", "", "c"]) == ["a", "b", "c"]
assert normpath(["a", "b", ".", "", "c", ".."]) == ["a", "b"]

def handle(format, html, text):
    if not format or html:
        pass
    formatter = text
    return formatter

assert handle(False, False, True)
assert not handle(True, False, False)
assert handle(True, True, False)
