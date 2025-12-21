import sys

if sys.argv[0] in frozenset({"attlist", "linktype", "link", "element"}):
    print("Yep")

