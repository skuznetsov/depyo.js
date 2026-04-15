import io

class BZ2File(io.BufferedIOBase):
    pass

class ABC(metaclass=BZ2File):
    pass
