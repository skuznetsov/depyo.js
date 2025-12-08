def start_new_thread(function, args, kwargs={}):
    try:
        function()
    except SystemExit:
        pass
    except:
        args()

def interact():
    while 1:
        try:
            more = 1
        except KeyboardInterrupt:
            more = 0