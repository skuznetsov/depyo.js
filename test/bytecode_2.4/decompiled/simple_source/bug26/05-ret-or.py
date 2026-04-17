class BufferedIncrementalEncoder(object):
    def getstate(self):
        return self.buffer or 0
