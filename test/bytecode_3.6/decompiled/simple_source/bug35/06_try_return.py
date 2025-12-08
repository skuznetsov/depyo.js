def do_commands(self, arg):
    if not arg:
        bnum = 1
    
    else:
        try:
            bnum = int(arg)
        except:
            self.error('Usage:')
            return
            self.commands_bnum = bnum