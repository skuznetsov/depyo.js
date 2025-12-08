while 1:
    if __file__:
        while 1:
            if __file__:
                break
            raise RuntimeError
    raise RuntimeError

def _parseparam(s, end):
    while 1:
        if end > 0 and s.count(""):
            end = s.find(";")