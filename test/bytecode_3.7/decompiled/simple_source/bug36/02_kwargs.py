def bug(self, j, a, b):
    self.parse_comment(j, report=0)
    self.parse_comment(j, report=1, foo=2)
    self.parse_comment(a, b, report=3)

import functools

@functools.lru_cache(maxsize=256, typed=True)
def _compile_pattern(pat):
    pass
