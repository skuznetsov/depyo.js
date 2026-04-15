import io

class BZ2File(io.BufferedIOBase):
    pass

class ABC(metaclass=BZ2File):
    pass

def test_customdescriptors_with_abstractmethod():
    class Descriptor:
        def setter(self):
            return Descriptor(self._fget)
