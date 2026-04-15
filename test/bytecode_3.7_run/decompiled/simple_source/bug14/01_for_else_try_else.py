def scan(items):
    for i in items:
        try:
            5 / i
        except:
            continue
        break
    
    return i
