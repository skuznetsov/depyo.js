def format_values(x, y, fmt):
    return f"hi {x} {y!r:{fmt}}"

def debug_values(a, b):
    return f"{a=}, {b!s}"

def ascii_value(val):
    return f"{val!a}"

def constant_spec(z):
    return f"{z:.2f}"

