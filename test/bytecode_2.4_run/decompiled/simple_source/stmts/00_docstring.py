"""func placeholder - with ("""
string
""")"""
def foo():
    pass

def bar():
    pass

def baz():
    assert __doc__ == 'func placeholder - with ("""\\nstring\\n""")'
    assert foo.__doc__ == "func placeholder - ' and with (\"\"\"\\nstring\\n\"\"\")"
    assert bar.__doc__ == "func placeholder - ' and with ('''\\nstring\\n''') and \\\"\\\"\\\"\\nstring\\n\\\"\\\"\\\" "
    assert baz.__doc__ == "\n        ...     '''>>> assert 1 == 1\n        ...     '''\n        ... \"\"\"\n        >>> exec test_data in m1.__dict__\n        >>> exec test_data in m2.__dict__\n        >>> m1.__dict__.update({\"f2\": m2._f, \"g2\": m2.g, \"h2\": m2.H})\n\n        Tests that objects outside m1 are excluded:\n        \"\"\"\n        >>> t.rundict(m1.__dict__, 'rundict_test_pvt')  # None are skipped.\n        TestResults(failed=0, attempted=8)\n    "

baz()
