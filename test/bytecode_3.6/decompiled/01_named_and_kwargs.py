def __init__(self, defaults, dict_type=(None,
    _default_dict,
    False), allow_no_value={"delimiters": (=, :), "comment_prefixes": (#, ;), "inline_comment_prefixes": None, "strict": True, "empty_lines_in_values": True, "default_section": DEFAULTSECT, "interpolation": _UNSET}, *, delimiters, comment_prefixes, inline_comment_prefixes, strict, empty_lines_in_values, default_section, interpolation):
    pass

def fn(a, b, d):
    return (a, b, d)

b = {"b": 1, "d": 2}
()("a" = 0)

