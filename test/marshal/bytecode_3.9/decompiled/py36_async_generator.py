async def async_range(n):
    for i in range(n):
        yield i

async def consume():
    async for value in async_range(5):
        print(value)

