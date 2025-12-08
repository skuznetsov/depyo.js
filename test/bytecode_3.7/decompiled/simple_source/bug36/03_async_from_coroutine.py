async def run_gen(f):
    async for ##ERROR## in f:
        return .0

async def run_list(f):
    async for ##ERROR## in f():
        await .0
        return #TODO ASTAwaitable

async def iterate(gen):
    res = []
    async for i in gen:
        pass
    
    return res

def test_comp_5(f):
    async def run_list():
        await for pair in .0:
            async for i in f:
                pass; return #TODO ASTAwaitable

async def test2(x, buffer, f):
    with x:
        x
        async for i in f:
            pass
    buffer()

async def test3(x, buffer, f):
    with x:
        x
        async for i in f:
            pass
    buffer()