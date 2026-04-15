"""func placeholder - with ("""
string
""")"""

def dq0():
    assert __doc__ == 'func placeholder - with ("""\\nstring\\n""")'

def dq1():
    assert dq1.__doc__ == "assert that dedent() has no effect on 'text'"

def dq2():
    assert dq1.__doc__ == "assert that dedent() has no effect on 'text'"

def dq3():
    assert dq3.__doc__ == "assert that dedent() has no effect on 'text\""

def dq4():
    assert dq4.__doc__ == "assert that dedent() has no effect on 'text'"

def dq5():
    assert dq5.__doc__ == "func placeholder - ' and with (\"\"\"\\nstring\\n\"\"\")"

def dq6():
    assert dq6.__doc__ == "func placeholder - ' and with ('''\\nstring\\n''') and \\\"\\\"\\\"\\nstring\\n\\\"\\\"\\\" "

def dq7():
    assert dq7.__doc__ == "        <----- SEE 'u' HERE\n  >>> mylen(u\"áéíóú\")\n  5\n  "

def baz():
    assert baz.__doc__ == "\n        ...     '''>>> assert 1 == 1\n        ...     '''\n        ... \"\"\"\n        >>> exec test_data in m1.__dict__\n        >>> exec test_data in m2.__dict__\n        >>> m1.__dict__.update({\"f2\": m2._f, \"g2\": m2.g, \"h2\": m2.H})\n\n        Tests that objects outside m1 are excluded:\n        \"\"\"\n        >>> t.rundict(m1.__dict__, 'rundict_test_pvt')  # None are skipped.\n        TestResults(failed=0, attempted=8)\n    "

dq0()
dq1()
dq2()
dq3()
dq4()
dq5()
dq6()

baz()
