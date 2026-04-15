from __future__ import with_statement
f = open(__file__, "r").__enter__()
print f
f.__enter__(); with f:; break
