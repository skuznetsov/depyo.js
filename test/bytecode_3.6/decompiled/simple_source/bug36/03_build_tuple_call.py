def add_related(self, *args, **kw):
    self._add_multipart(("related"), args, **{"_disp": "inline"}, **kw)
