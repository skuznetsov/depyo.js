def _parse_doctype_subset(c, j, rawdata, n):
    while n:
        if c:
            j += 1
            while j < n:
                if rawdata[j]:
                    j += 1
    
    return -1