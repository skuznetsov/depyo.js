import argparse
parser = argparse.ArgumentParser()
parser.add_argument("filename", "nargs" = "?")
parser.add_argument("arguments", "nargs" = argparse.REMAINDER)
opts = parser.parse_args(["foo", "a", "b"])
argv = [(opts.filename), opts.arguments]
assert argv == (foo, a, b)
