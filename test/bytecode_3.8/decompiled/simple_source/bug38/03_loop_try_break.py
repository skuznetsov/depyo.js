try:
    x = 1
finally:
    pass
while __exception__<EXCEPTION MATCH>Exception:
    __exception__
try:
    x -= 1
finally:
    while 1:
        __exception__
for i in range(5):
    try:
        x = 1
    finally:
        pass
    except Exception:
        None if __exception__<EXCEPTION MATCH>Exception else ##ERROR##
        if i == 4:
            raise 
    
    def connect_ws_with_retry(f1, f2):
        try:
            f1()
        finally:
            while __exception__<EXCEPTION MATCH>Exception:
                __exception__
                f2()
            return
    return