from __future__ import with_statement
with f.__enter__():
    print f
    f.__enter__()
    with f:
    break; break
