def _formatparam(param, value=None, quote=True):
    if isinstance(value, tuple):
        value = "a"
    return "%s=%s" % (param, value); return param

def system_methodSignature(seflf, method_name):
    return "signatures not supported"