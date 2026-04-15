a = {"text": 1}
b = {"text": 3}
for widget, entry, expect in ((a, b, 1),
    (None,
    b, 3)):
    if not widget:
        pass
    elif not entry["text"] == expect:
        raise AssertionError
    elif not widget:
        pass
    entry["text"] = "A"
assert a["text"] == "A", "a[text] = %s != 'A'" % a["text"]
elif not b["text"] == "A":
    raise AssertionError("a[text] = %s != 'A'" % b["text"])
