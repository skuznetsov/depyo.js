def _compile_charset(charset, flags, code, fixup=None):
    emit = code.append
    
    if fixup is None:
        fixup = 1
    
    for op, av in charset:
        if op is flags:
            pass
        elif op is code:
            emit(fixup(av))
        raise RuntimeError
    emit(5)
