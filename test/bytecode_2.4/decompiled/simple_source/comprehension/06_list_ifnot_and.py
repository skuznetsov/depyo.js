def list_public_methods(obj):
    for ##ERROR## in dir(obj):
        if not member.startswith("_") and hasattr(getattr(obj, member), "__call__"):
            pass
    
    return (member := ##ERROR##)[member]
