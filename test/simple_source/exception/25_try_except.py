# Tests:
#
#   tryfinallystmt ::= SETUP_FINALLY suite_stmts POP_BLOCK LOAD_CONST COME_FROM suite_stmts_opt END_FINALLY
#   suite_stmts_opt ::= suite_stmts
#   try_except ::= SETUP_EXCEPT suite_stmts_opt POP_BLOCK except_handler COME_FROM
#   except_handler ::= JUMP_FORWARD COME_FROM except_stmts END_FINALLY COME_FROM
#   except_stmt ::= except_cond1 except_suite
#   except_cond1 ::= DUP_TOP expr COMPARE_OP jmp_false POP_TOP POP_TOP POP_TOP
#   try_except ::= SETUP_EXCEPT suite_stmts_opt POP_BLOCK except_handler COME_FROM
#   except_handler ::= JUMP_FORWARD COME_FROM except_stmts END_FINALLY COME_FROM
#   except_cond1 ::= DUP_TOP expr COMPARE_OP jmp_false POP_TOP POP_TOP POP_TOP
try:
    try:
        x = 1
    except AssertionError:
        x = 2

except ImportError:
    x = 3
finally:
    x = 4

# Tests Python3:
#   try_except ::= SETUP_EXCEPT suite_stmts_opt POP_BLOCK except_handler come_froms
#   come_froms ::= COME_FROM COME_FROM
#   START ::= |- stmts
#   stmts ::= sstmt
#   sstmt ::= stmt
#   stmt ::= try_except
#   try_except ::= SETUP_EXCEPT suite_stmts_opt POP_BLOCK except_handler come_froms
#   come_froms ::= COME_FROM
#   except_handler ::= JUMP_FORWARD COME_FROM except_stmts END_FINALLY COME_FROM
# Python2 doesn't have the come_froms (which allows for 3 successive COME_FROMs)
# it does place 2 COME_FROMs at the end of this code.

try:
    x = 1
except SystemExit:
    x = 2
except:
    x = 3

# Try except in loops

for i in (1, 2):
    try:
        x = 1
    except ValueError:
        y = 2

for badarg in (2, 3):
    try:
        pass
    except TypeError:
        pass
    except ValueError:
        if badarg:
            pass
        else:
            y = 3
    else:
        y = 4
