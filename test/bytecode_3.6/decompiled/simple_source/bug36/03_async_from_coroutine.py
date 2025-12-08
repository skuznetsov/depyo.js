async def run_gen(f):
    async for ##ERROR## in f:
        return (lambda .0: try:
    yield from await(.0.__anext__)
    i = await(.0.__anext__)
if not ###FIXME###<EXCEPTION MATCH>StopAsyncIteration:
    yield 10
    __exception__; __exception__; .0)(##ERROR##)

async def run_list(f):
    async for ##ERROR## in f():
        await (lambda .0: try:
    yield from await(.0.__anext__)
    i = await(.0.__anext__)
if not ###FIXME###<EXCEPTION MATCH>StopAsyncIteration:
    pass; __exception__[i]; __exception__; __exception__; .0)(##ERROR##)
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