async def a(b, c):
    async for b in c:
        pass

async def foo(X):
    async for i in X:
        pass
    
    async for i in X:
        pass
    raise Done