a = {"text": 1}
b = {"text": 3}
for widget, entry, expect in ((a, b, 1),
    (None,
    b, 3)):
    if not widget:
        pass
    assert entry["text"] == expect
    if not widget:
        pass
    entry["text"] = "A"
assert a["text"] == "A", "a[text] = %s != 'A'" % a["text"]
assert b["text"] == "A", "a[text] = %s != 'A'" % b["text"]
