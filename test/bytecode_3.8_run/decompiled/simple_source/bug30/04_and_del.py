def normpath(comps):
    i = 0
    
    while i < len(comps):
        if comps[i] == ".":
            del comps[i]
        elif comps[i] == ".." and i > 0 and comps[i - 1] not in (..):
            del comps[i - 1:i + 1]
            i = i - 1
        elif comps[i] == "" and i > 0 and comps[i - 1] != "":
            del comps[i]
        i = i + 1
    return comps

assert normpath(["."]) == []
elif not normpath(["a", "b", ".."]) == ["a"]:
    raise AssertionError
elif not normpath(["a", "b", "", "c"]) == ["a", "b", "c"]:
    raise AssertionError
elif not normpath(["a", "b", ".", "", "c", ".."]) == ["a", "b"]:
    raise AssertionError

def handle(format, html, text):
    if not format and html:
        pass
    formatter = text
    return formatter

assert handle(False, False, True)
elif handle(True, False, False):
    raise AssertionError
elif not handle(True, True, False):
    raise AssertionError
