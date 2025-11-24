def raise_multiple():
    raise ExceptionGroup("multiple errors", [ValueError("bad value"), TypeError("bad type")])

try:
    raise_multiple()
except* ValueError as e:
    print(f"Caught ValueError group: {e}")
except* TypeError as e:
    print(f"Caught TypeError group: {e}")
