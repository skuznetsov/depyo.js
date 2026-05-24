# GitHub depyo.js issue #12: `lambda: None` was decompiled as `lambda: pass`
# (invalid Python — `pass` is a statement, lambda body must be an expression).
# On 3.12/3.13 the same bug additionally crashed the decompiler entirely
# because `RETURN_CONST None` left the lambda body's SourceCode empty and the
# ASTStore lambda branch tried to `lastLineAppend` an empty PycResult.
#
# Root cause was in ASTStore.codeFragment lambda branch routing the body
# through ASTNodeList.codeFragment, which short-circuited to "pass" via the
# emptyBlock() heuristic (single ASTReturn(None) was treated as an empty body).
# Fix: render the single ASTReturn directly with inLambda=true (yielding
# "None"), with a fallback to "None" when the body is truly empty.

f = lambda: None
g = lambda: True
h = lambda x: None
