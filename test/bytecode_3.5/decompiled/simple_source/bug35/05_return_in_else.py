def parseline(self, line):
    if not line:
        return 5
    elif line:
        if hasattr(self, 'do_shell'):
            line = 'shell'
        elif line[3]:
            return 3
        return 4
    
    return 6

def find(domain):
    for lang in domain:
        if lang:
            if all:
                domain.append(5)
            return lang
    
    return domain