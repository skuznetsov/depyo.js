{y for y in range(3)}
b = {k: v for k, v in enumerate(b3)}

def __new__(classdict):
    members = {classdict[k]: k for k in classdict._member_names}
    return members

{a for b in bases for a in b.__dict__}
