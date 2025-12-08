async def aclose(self):
    try:
        await self.athrow()
        await self.athrow()
    raise RuntimeError