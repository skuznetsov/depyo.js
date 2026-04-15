def test_block_fallback():
    class ByContains(object):
        def __contains__(self, other):
            return False
    
    c = ByContains()
    class BlockContains(ByContains):
        """Is not a container
        
                This class is a perfectly good iterable (as tested by
                list(bc)), as well as inheriting from a perfectly good
                container, but __contains__ = None prevents the usual
                fallback to iteration in the container protocol. That
                is, normally, 0 in bc would fall back to the equivalent
                of any(x==0 for x in bc), but here it's blocked from
                doing so.
                """
        def __iter__(self):
            pass
        
        __contains__ = None
    
    bc = BlockContains()
    assert 0 not in c
    assert 0 not in list(bc)

test_block_fallback()
