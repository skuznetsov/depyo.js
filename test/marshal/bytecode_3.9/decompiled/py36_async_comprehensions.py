async def async_generator():
    for i in range(5):
        yield i

async def use_async_comp():
    async for result in async_generator():
        await try:
            yield from await(.0.__anext__)
        return __exception__
        async for squared in async_generator():
            await try:
                yield from await(.0.__anext__)
            return __exception__
            return result

