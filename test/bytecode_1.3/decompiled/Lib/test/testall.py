import test_support

print "test_grammar"
forget("test_grammar")
import test_grammar

print "test_opcodes"
unload("test_opcodes")
import test_opcodes

print "test_operations"
unload("test_operations")
import test_operations

print "test_builtin"
unload("test_builtin")
import test_builtin

print "test_exceptions"
unload("test_exceptions")
import test_exceptions

print "test_types"
unload("test_types")
import test_types

print "Passed all tests."
