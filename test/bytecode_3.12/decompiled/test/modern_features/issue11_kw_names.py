def func(*a, **kw):
    return (a, kw)

class Obj:
    def meth(self, **kw):
        return kw

obj = Obj(); single = func(b=2); mixed_one = func(1, b=2); mixed_many = func(1, 2, a=3, b=4); method = obj.meth(x=5); many_kwargs = dict(a=1, b=2, c=3); builtin = print("hi", end="", flush=True)
