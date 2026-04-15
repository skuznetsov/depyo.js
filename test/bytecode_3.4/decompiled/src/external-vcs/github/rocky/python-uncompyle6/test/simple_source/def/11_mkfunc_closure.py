class _OverlappedFuture(futures.Future):
    def __init__(self, ov, *, loop=None):
        super().__init__(loop=loop)
