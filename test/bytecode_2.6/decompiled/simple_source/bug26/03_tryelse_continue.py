def test_specific_values(self):
    for flags in self:
        if flags:
            try:
                self = 1
            except ValueError:
                
            self = 2
        self = 3

def call(*args):
    try:
        return 5
    except KeyError:
        pass
    except TypeError:
        return 3
