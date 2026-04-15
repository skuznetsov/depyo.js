async def aclose(self):
    try:
        await self.athrow()
        await self.athrow()
    except GeneratorExit:
        pass
    else:
        raise RuntimeError
