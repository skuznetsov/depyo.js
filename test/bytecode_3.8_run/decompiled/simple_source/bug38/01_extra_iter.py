qs = "https://travis-ci.org/rocky/python-uncompyle6/builds/605260823?utm_medium=notification&utm_source=email"
expect = ["https://travis-ci.org/rocky/python-uncompyle6/builds/605260823?utm_medium=notification", "utm_source=email"]

assert expect == for s1 in .0:
    [s2 for s2 in s1.split(";")]
