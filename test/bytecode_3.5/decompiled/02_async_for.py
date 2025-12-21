async def a(b, c):
    async for b in c:
        try:
            yield from await(##ERROR##.__anext__)
        __exception__
        await(##ERROR##.__anext__)

async def foo(X):
    async for i in X:
        try:
            yield from await(##ERROR##.__anext__)
        __exception__
        await(##ERROR##.__anext__)
    
    async for i in X:
        try:
            yield from await(##ERROR##.__anext__)
        __exception__
        await(##ERROR##.__anext__)
    raise Done

