def __instancecheck__(cls, instance):
    return any((cls.__subclasscheck__(c) for c in {subclass, subtype}))
