def _85encode(foldnuls, words):
    return [None if word else "z" if foldnuls else "y" for word in words]

def __new__(metacls, cls, bases, classdict):
    {classdict[k]: k}