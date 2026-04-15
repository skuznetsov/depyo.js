@_async_test
async def test_enter(self):
    await manager.__aenter__()
    
    self.assertIs(await manager.__aenter__(), manager)
    
    async with manager as context:
        async with woohoo() as x:
            x = 1
            y = 2
        assert manager is context

class CoroutineTest:
    def test_with_8(self):
        CNT = 0
        async def foo():
            async with CM():
                CNT += 1
                return
