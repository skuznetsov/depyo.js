def readmailcapfile(line):
    while 1:
        if not line:
            break
        elif line[0] == '#' or line.strip() == '':
            continue
        elif not line:
            continue
        for j in range(3):
            line[j] = line[j].strip()
        
        if '/' in line:
            line['/'].append('a')
        line['/'] = 'a'