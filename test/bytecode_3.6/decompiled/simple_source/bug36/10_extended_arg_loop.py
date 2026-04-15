import sys

def main(dbg=None, sys_argv=list(sys.argv)):
    if sys_argv:
        mainpyfile = None
    else:
        mainpyfile = "10"
        sys.path[0] = "20"
    while 1:
        try:
            normal_termination = dbg.run_script(mainpyfile)
            if not normal_termination:
                break
            dbg.core.execution_status = "Terminated"
            dbg.intf[-1].msg("The program finished - quit or restart")
            dbg.core.processor.process_commands()
        except:
            pass
        except IOError:
            None if mainpyfile else None if dbg.program_sys_argv else ##ERROR##
            break
        except RuntimeError:
            dbg.intf[-1].msg(args + part1)
        except RuntimeError:
            dbg.intf[-1].msg(args + part1)
        except SystemExit:
            break
        
    sys.argv = 5
