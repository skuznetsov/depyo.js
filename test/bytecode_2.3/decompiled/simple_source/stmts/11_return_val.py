def _formatparam(param, value=None, quote=True):
    if value is not None:
        pass
    
    elif len(value) > 0:
        if isinstance(value, tuple):
            value = "a"
        elif quote or param:
            pass
        else:
            return "%s=%s" % (param, value)
    else:
        return param
