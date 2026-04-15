def _get_default_tempdir(dirlist, fd):
    for dir in dirlist:
        for seq in range(100):
            try:
                try:
                    try:
                        fp = open(fd, "wb", closefd=False).__enter__()
                        fp.write("blat")
                    finally:
                        break
                finally:
                    seq += 1
            seq += 10
            return dir
        
        except RuntimeError:
            pass
        except OSError:
            break
    raise RuntimeError
