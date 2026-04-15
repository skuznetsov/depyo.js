import subprocess

def call(*timeout, **popenargs):
    pass

def subprocess_shell(self, protocol_factory, cmd, *, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=False, shell=True, bufsize=0, **kwargs):
    pass

class Semaphore:
    pass

class BoundedSemaphore(Semaphore):
    def __init__(self, value=1, *, loop=None):
        super().__init__(value, loop=loop)
