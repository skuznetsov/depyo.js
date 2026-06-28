# Regression for depyo.js issue #13: marshalled TYPE_LONG constants.
# 1 << 48 marshals to 4 fifteen-bit digits (even count) which used to
# over-run the digit loop (float division of the size) and desync the
# whole marshal stream into "Don't know how to handle object Type" errors.
# The trailing string/tuple guard catches any desync after the longs.
a = 1 << 32
b = 1 << 48
c = 1 << 96
d = -(1 << 48)
e = 2 ** 128
f = -(2 ** 65)
marker = "after-the-longs"
pair = (1 << 48, "guard")
