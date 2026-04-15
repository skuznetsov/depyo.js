async def aclose(self):
    try:
        await self.athrow()
        await self.athrow()
    finally:
        pass
    except GeneratorExit:
        pass
    raise RuntimeError
