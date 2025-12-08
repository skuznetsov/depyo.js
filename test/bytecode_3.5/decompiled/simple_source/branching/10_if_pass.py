from weakref import ref

class _localimpl:
    ; __qualname__ = '_localimpl'
    
    def create_dict(self, thread):
        localdict = {}
        idt = id(thread)
        def thread_deleted(_, idt=(wrlocal)):
            local = wrlocal()
            if local is not None:
                pass
        
        wrlocal = ref(self, local_deleted)
        return localdict