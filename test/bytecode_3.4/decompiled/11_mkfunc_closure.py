class _OverlappedFuture(futures.Future):
    def __init__(self, ov, *, loop=(__class__)):
        super().__init__("loop" = loop)

