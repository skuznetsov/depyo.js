def __sub__(self, other):
    return self.__class__((i for i in self if i not in other))
