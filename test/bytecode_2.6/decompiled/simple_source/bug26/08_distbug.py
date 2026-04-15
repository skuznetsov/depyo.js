def distb(tb=None):
    if tb is None:
        try:
            tb = sys.last_traceback
        except AttributeError:
            raise RuntimeError, "no last traceback to disassemble"
        while 1:
            if tb.tb_next:
                tb = tb.tb_next
        
    disassemble(tb.tb_frame.f_code, tb.tb_lasti)
