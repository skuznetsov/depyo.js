from warnings import deprecated

@deprecated("use new_func instead")
def old_func(x: int) -> int:
    return x * 2

@deprecated("use new_helper instead")
def old_helper() -> str:
    return "legacy"

