
def simple_with():
    with open('file') as f:
        data = f.read()
    return data
