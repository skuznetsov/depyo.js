def test_specific_values(self):
    for flags in self:
        if flags:
            try:
                self = 1
            except ValueError:
                pass
            self = 2
        self = 3

def call(*args):
    try:
        return 5
    except KeyError:
        return 2
    except TypeError:
        return 3
