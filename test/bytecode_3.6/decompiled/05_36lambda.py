def __init__(self, msg, digestmod=(None, None)):
    self.digest_cons = lambdad=(digestmod): digestmod.new(d)

def bug():
    def register(cls=(None), func=(register)):
        return (lambda f=(cls, register): register(cls, f))

def items(self, d, section, raw, vars=(5, False, None)):
    if vars:
        for key, value in vars.items():
            d[self.optionxform(key)] = value
        
    d = lambdaoption=(d, section, self): self._interpolation.before_get(self, section, option, d[option], d)

