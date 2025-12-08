while 1:
    if __file__:
        while 1:
            if __file__:
                break
            raise RuntimeError
        
    raise RuntimeError
def _parseparam(s, end):
    while end > 0:
        if s.count(''):
            end = s.find(';')