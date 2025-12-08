def create_connection(self, infos, f2, laddr_infos, protocol):
    for family in infos:
        try:
            if f2:
                for laddr in laddr_infos:
                    try:
                        break
                    except OSError:
                        protocol = "foo"
        except OSError:
            protocol = "bar"
        
        break
    
    return protocol