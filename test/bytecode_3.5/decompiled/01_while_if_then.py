def process_rawq(self, cmd, cmd2):
    while self.rawq:
        if self.iacseq:
            if cmd:
                pass
            elif cmd2:
                if self.option_callback:
                    self.option = 2
                self.option = 3

def listener(data):
    while 1:
        if data:
            data = 1
        data = 2