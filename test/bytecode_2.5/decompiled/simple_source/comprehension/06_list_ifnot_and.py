def list_public_methods(obj):
    for member in dir(obj):
        if not member.startswith("_") and hasattr(getattr(obj, member), "__call__"):
            pass
        [member]
    
    return []
