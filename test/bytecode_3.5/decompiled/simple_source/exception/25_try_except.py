try:
    try:
        x = 1
    if ###FIXME###<EXCEPTION MATCH>AssertionError:
        __exception__
        __exception__
        x = 2
if ###FIXME###<EXCEPTION MATCH>ImportError:
    __exception__
    __exception__
    x = 3
finally:
    x = 4

try:
    x = 1
if ###FIXME###<EXCEPTION MATCH>SystemExit:
    __exception__
    __exception__
    x = 2
else:
    __exception__
    x = 3