try:
    a = 1 / 0
except:
    print "Pass 0: in except block"
else:
    a = 2
    print "Pass 0: else block"
try:
    a = 1 / 0
except:
    print "Pass 1: in except block"
else:
    a = 2
    print "Pass 1: else block"
finally:
    pass

print "Pass 1: in finally block"

try:
    try:
        a = 1 / 0
    except:
        print "Pass 2: in inner except block"
        print "Pass 2.1: in else block in inner except block"
    print "Pass 2.1: in finally block in inner except block"

print "Pass 2: in outer finally block"
try:
    a = 1 / 0
except Exception as ex:
    pass
finally:
    pass

print "Pass 3: in finally block"

