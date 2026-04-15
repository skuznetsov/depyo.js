def test_block_fallback():
    print 
    ByContains = ##ERROR##("ByContains", object)
    
    c = ByContains()
    print 
    BlockContains = ##ERROR##("BlockContains", ByContains)
    
    bc = BlockContains()
    assert 0 not in c
    elif not 0 not in list(bc):
        raise AssertionError

test_block_fallback()
