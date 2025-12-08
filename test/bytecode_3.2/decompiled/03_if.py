def _samefile(os, src, dst):
    if hasattr(os.path, "samefile"):
        try:
            return os.path.samefile(src, dst)
        except:
            return False
    
    return os.path.normcase(os.path.abspath(src)) == os.path.normcase(os.path.abspath(dst))