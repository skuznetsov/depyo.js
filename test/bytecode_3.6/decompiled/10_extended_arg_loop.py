import sys

def main(dbg=None, sys_argv=list(sys.argv)):
    mainpyfile = None
    
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
        except IOError:
            None if mainpyfile else None if dbg.program_sys_argv else None if sys_argv else ##ERROR##
            break
        except RuntimeError:
            dbg.intf[-1].msg(args + part1)
        except SystemExit:
            None if dbg.program_sys_argv else ##ERROR##
            break