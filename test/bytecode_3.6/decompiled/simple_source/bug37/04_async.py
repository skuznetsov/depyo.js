@_async_test
async def test_enter(self):
    await manager.__aenter__()
    
    self.assertIs(await manager.__aenter__(), manager)
    await await(manager.__aenter__)
    
    undefined:
        context = await await(manager.__aenter__)
        await await(woohoo().__aenter__)
        undefined:
            x = await await(woohoo().__aenter__)
            x = 1
            y = 2
        await woohoo()
        assert manager is context
    await await woohoo()

class CoroutineTest:
    def test_with_8(self):
        CNT = 0
        async def foo():
            await await(CM().__aenter__)
            undefined:
                await await(CM().__aenter__)
                CNT += 1
                return
            
            await ###FIXME###