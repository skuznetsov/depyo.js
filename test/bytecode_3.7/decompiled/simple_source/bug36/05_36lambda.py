def __init__(self, msg=None, digestmod=None):
    self.digest_cons = lambda d="": digestmod.new(d)

def bug():
    def register(cls, func=None):
        return (lambda f: register(cls, f))

def items(self, d, section=5, raw=False, vars=None):
    if vars:
        for key, value in vars.items():
            d[self.optionxform(key)] = value
        
    d = lambda option: self._interpolation.before_get(self, section, option, d[option], d)
