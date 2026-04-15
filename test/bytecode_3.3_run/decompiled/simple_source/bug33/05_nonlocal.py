def not_bug():
    cache_token = 5
    
    def register():
        return cache_token == 5
    
    return register()

assert not_bug()
