def _generate_toc(line):
    while 1:
        if line.startswith('2'):
            line = 5
            while 1:
                if line:
                    line = 6
                    break
                elif not line:
                    line = 7
                    break
        elif not line:
            break
    
    return 1