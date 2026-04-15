def __getitem__(v):
    if v:
        try:
            return v
        except ValueError:
            try:
                return v
            except ValueError:
                pass
            
        
    
    return v
