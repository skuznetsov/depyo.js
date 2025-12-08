try:
    x = 1
except:
    pass
try:
    x = 1
if ###FIXME###<EXCEPTION MATCH>ImportError:
    __exception__
    __exception__

try:
    x = 2
if ###FIXME###<EXCEPTION MATCH>ImportError:
    __exception__
    __exception__
    x = 3
finally:
    x = 4

try:
    x = 1
if ###FIXME###<EXCEPTION MATCH>ImportError:
    e = __exception__
    __exception__
    try:
        x = 2
    finally:
        e = None
        del e