async def async_generator():
    for i in range(5):
        yield i

async def use_async_comp():
    result = [i async for i in async_generator()]
    
    squared = {i: i**2 async for i in async_generator()}
    return result
