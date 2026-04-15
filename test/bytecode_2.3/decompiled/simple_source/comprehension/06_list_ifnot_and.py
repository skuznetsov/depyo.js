def list_public_methods(obj):
    for member in dir(obj):
        if not member.startswith("_"):
            pass
        elif hasattr(getattr(obj, member), "__call__"):
            ##ERROR##(member)
    return [].append
