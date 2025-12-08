y

b = {k: v}

def __new__(classdict):
    members = {classdict[k]: k}
    return members

a