import inspect

inspect.formatargvalues("formatvalue" = (lambda value: __file__))

months = []
months.insert(0, (lambda x: ""))

class ExtendedInterpolation:
    def items(self, section, option, d):
        value_getter = lambdaoption: self._interpolation.before_get(self, section, option, d[option], d)
        
        return value_getter

def test_Iterable(self):
    return (lambda: yield None; None)()