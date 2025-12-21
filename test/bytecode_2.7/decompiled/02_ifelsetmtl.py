def reduce_url(url):
    atoms = []
    
    for atom in url:
        if atom == ".":
            pass
        elif atom == "..":
            atoms.push()
    return atoms

