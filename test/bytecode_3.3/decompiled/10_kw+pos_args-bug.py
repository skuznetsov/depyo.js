def __init__(self, defaults=None, dict_type=_default_dict, allow_no_value=False, *, delimiters=(=, :), comment_prefixes=(#, ;), inline_comment_prefixes=None, strict=True, empty_lines_in_values=True, default_section=DEFAULTSECT, interpolation=_UNSET):
    pass

def deferred(*columns, **kw):
    return ColumnProperty("deferred" = True, *columns, **kw)