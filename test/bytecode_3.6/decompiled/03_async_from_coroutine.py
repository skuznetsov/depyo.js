async def run_gen(f):
    async for ##ERROR## in f:
        return .0

async def run_list(f):
    async for ##ERROR## in f():
        await []
        return await []

async def iterate(gen):
    res = []
    async for i in gen:
        try:
            yield from await(##ERROR##.__anext__)
        except StopAsyncIteration:
            pass
        __exception__
        await(##ERROR##.__anext__)
    
    return res

def test_comp_5(f):
    async def run_list():
        await [##ERROR##.__anext__ for pair in (10, 20)]; return await [##ERROR##.__anext__ for pair in (10, 20)]

async def test2(x, buffer, f):
    with x:
        x
        async for i in f:
            try:
                yield from await(##ERROR##.__anext__)
            except StopAsyncIteration:
                pass
            await(##ERROR##.__anext__)
        buffer()
    buffer()

async def test3(x, buffer, f):
    with x:
        x
        async for i in f:
            try:
                yield from await(##ERROR##.__anext__)
            except StopAsyncIteration:
                pass
            __exception__
            await(##ERROR##.__anext__)
        buffer.append()
    buffer()

