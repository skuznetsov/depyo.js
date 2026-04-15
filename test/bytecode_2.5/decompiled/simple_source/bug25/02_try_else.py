def options(self, section):
    try:
        opts = self._sections[section].copy()
    except KeyError:
        pass
    opts.update(self._defaults)
    if "__name__" in opts:
        del opts["__name__"]
    
    return opts.keys()
