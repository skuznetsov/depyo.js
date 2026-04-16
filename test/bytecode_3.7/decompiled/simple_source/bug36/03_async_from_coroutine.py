async def run_gen(f):
    return (10 async for i in f)

async def run_list(f):
    return [i async for i in f()]

async def iterate(gen):
    res = []
    async for i in gen:
        pass
    
    return res

def test_comp_5(f):
    async def run_list():
        await for pair in .0:
            async for i in f:
                pass; return await for pair in .0:
    async for i in f:
        pass

async def test2(x, buffer, f):
    with x:
        async for i in f:
            pass
    buffer()

async def test3(x, buffer, f):
    with x:
        async for i in f:
            pass
    buffer()
