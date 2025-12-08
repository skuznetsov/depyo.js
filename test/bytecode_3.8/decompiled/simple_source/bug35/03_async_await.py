def await_test(asyncio, *, reader, writer, ###MISSING_VAR###):
    await asyncio.open_connection(80)
    
    reader, writer = await asyncio.open_connection(80)
    await bar()
    await bar()

async def afor_test():
    async for i in [1, 2, 3]:
        pass

async def afor_else_test():
    async for i in [1, 2, 3]:
        pass
    
    z = 4

async def awith_test():
    await await(i.__aenter__)
    
    undefined:
        await await(i.__aenter__)
        print(i)
    await ###FIXME###

async def awith_as_test():
    await await(1.__aenter__)
    
    undefined:
        i = await await(1.__aenter__)
        print(i)
    await ###FIXME###

async def f(z, *, ###MISSING_VAR###):
    await z
    await z

async def g(z, *, ###MISSING_VAR###):
    await z; return await z