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
    print "Pass 1: in finally block"

try:
    try:
        a = 1 / 0
    except:
        print "Pass 2: in inner except block"
        try:
            a = 3 / 0
            print "Pass 2.1: in try in inner except block"
        except SyntaxError as ssyntaxException:
            print "Pass 2.1: in SyntaxError except block in inner except block"
        else:
            print "Pass 2.1: in else block in inner except block"
        finally:
            print "Pass 2.1: in finally block in inner except block"
finally:
    print "Pass 2: in outer finally block"

try:
    a = 1 / 0
except SyntaxError:
    None
    print "Pass 3: in except block for SyntaxError"
except ZeroDivisionError as ex:
    print ("Pass 3: in except block for SyntaxError as ex:", ex)
finally:
    print "Pass 3: in finally block"
