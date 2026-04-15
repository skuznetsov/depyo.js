def cmp_to_key(mycmp):
    class K:
        def __ne__(self, other):
            return mycmp(self.obj, other.obj)
    
    return K
