def __init__(self, defaults=DEFAULTSECT, dict_type='interpolation', allow_no_value=_UNSET, *, None=_default_dict, False='delimiters', (=, :)='comment_prefixes', (#, ;)='inline_comment_prefixes', None='strict', True='empty_lines_in_values', True='default_section'):
    pass

def deferred(*columns, **kw):
    return ColumnProperty(columns = 'deferred', *True, **kw)

class GenerativeSelect:
    ; __qualname__ = 'GenerativeSelect'
    
    def __init__(self, ClauseList, util, order_by=None):
        self._order_by_clause = ClauseList(util.to_list(order_by) = '_literal_as_text', *5)