import sys
def main(dbg, sys_argv=(None,
    list(sys.argv))):
    if sys_argv:
        mainpyfile = None
    else:
        mainpyfile = '10'
        sys.path[0] = '20'
    while 1:
        try:
            if dbg.program_sys_argv and mainpyfile:
                normal_termination = dbg.run_script(mainpyfile)
                if not normal_termination:
                    break
                    dbg.core.execution_status = 'Terminated'
                    dbg.intf[-1].msg('The program finished - quit or restart')
                    dbg.core.processor.process_commands()
        if ###FIXME###<EXCEPTION MATCH>IOError:
            __exception__
            __exception__
            break
        elif ##ERROR##<EXCEPTION MATCH>RuntimeError:
            dbg.core.execution_status = 'Restart requested'
            if dbg.program_sys_argv:
                sys.argv = list(dbg.program_sys_argv)
                part1 = 'Restarting %s with arguments:' % dbg.core.filename(mainpyfile)
                args = ' '.join(dbg.program_sys_argv[1:])
                dbg.intf[-1].msg(args + part1)
            break
        elif ##ERROR##<EXCEPTION MATCH>SystemExit:
            break