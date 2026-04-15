async def await_test(asyncio):
    await asyncio.open_connection(80)
    
    reader, writer = await asyncio.open_connection(80)
    await bar()
    await bar()

async def afor_test():
    async for i in [1, 2, 3]:
        try:
            yield from await(##ERROR##.__anext__)
        except StopAsyncIteration:
            pass
        __exception__
        await(##ERROR##.__anext__)

async def afor_else_test():
    async for i in [1, 2, 3]:
        try:
            yield from await(##ERROR##.__anext__)
        except StopAsyncIteration:
            pass
        __exception__
        await(##ERROR##.__anext__)
    z = 4

async def awith_test():
    async with i:
        print(i)

async def awith_as_test():
    async with 1 as i:
        print(i)

async def f(z):
    await z
    await z

async def g(z):
    await z; return await z
