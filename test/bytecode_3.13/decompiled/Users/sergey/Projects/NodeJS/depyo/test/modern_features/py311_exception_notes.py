
try:
    raise ValueError("something went wrong")
except ValueError as e:
    e.add_note("Additional context")
    e.add_note("Even more info")
    raise
