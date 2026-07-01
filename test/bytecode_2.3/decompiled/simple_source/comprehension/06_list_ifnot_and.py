def list_public_methods(obj):
    return [member for member in dir(obj) if hasattr(getattr(obj, member), "__call__")]
