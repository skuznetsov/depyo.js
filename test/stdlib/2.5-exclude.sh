SKIP_TESTS=(
    [test_aepack.py]=1 # it fails on its own
    [test_al.py]=1 # it fails on its own
    [test_applesingle.py]=1 # it fails on its own
    [test_bsddb185.py]=1 # it fails on its own
    [test_bsddb3.py]=1 # it fails on its own
    [test_bsddb.py]=1 # it fails on its own
    [test_cd.py]=1 # it fails on its own
    [test_cl.py]=1 # it fails on its own
    [test_codecmaps_cn.py]=1 # it fails on its own
    [test_codecmaps_hk.py]=1 # it fails on its own
    [test_codecmaps_jp.py]=1 # it fails on its own
    [test_codecmaps_kr.py]=1 # it fails on its own
    [test_codecmaps_tw.py]=1 # it fails on its own
    [test_curses.py]=1 # it fails on its own
    [test_dbm.py]=1 # it fails on its own
    [test_dl.py]=1 # it fails on its own
    [test_gdbm.py]=1 # it fails on its own
    [test_gl.py]=1 # it fails on its own
    [test_imageop.py]=1 # it fails on its own
    [test_imgfile.py]=1 # it fails on its own
    [test_linuxaudiodev.py]=1 # it fails on its own
    [test_macfs.py]=1 # it fails on its own
    [test_macostools.py]=1 # it fails on its own
    [test_nis.py]=1 # it fails on its own
    [test_normalization.py]=1 # it fails on its own
    [test_ossaudiodev.py]=1 # it fails on its own
    [test_plistlib.py]=1 # it fails on its own
    [test_rgbimg.py]=1 # it fails on its own
    [test_scriptpackages.py]=1 # it fails on its own
    [test_sunaudiodev.py]=1 # it fails on its own
    [test_support.py]=1 # it fails on its own
    [test_tcl.py]=1 # it fails on its own
    [test_urllib2net.py]=1 # it fails on its own
    [test_urllibnet.py]=1 # it fails on its own
    [test_winreg.py]=1 # it fails on its own
    [test_winsound.py]=1 # it fails on its own
    [test_zlib.py]=1 # it fails on its own


    [test_coercion.py]=1
    [test_decimal.py]=1
    [test_dis.py]=1        # We change line numbers - duh!
    [test_file.py]=1       # test assertion failures
    [test_generators.py]=1 # Investigate
    # [test_grammar.py]=1    # fails on its own - no module tests.test_support
    [test_grp.py]=1        # Long test - might work Control flow?
    [test_macfs.py]=1      # it fails on its own
    [test_macostools.py]=1 # it fails on its own
    [test_mailbox.py]=1
    [test_nis.py]=1        # it fails on its own
    [test_normalization.py]=1 # it fails on its own
    [test_optparse.py]=1   # it fails on its own
    [test_ossaudiodev.py]=1 # it fails on its own
    [test_pdb.py]=1        # Line-number specific
    [test_pep277.py]=1    # it fails on its own
    [test_plistlib.py]=1 # it fails on its own
    [test_pyclbr.py]=1 # Investigate
    [test_rgbimg.py]=1 #  it fails on its own
    [test_scriptpackages.py]=1 # it fails on its own
    [test_socketserver.py]=1 # Too long to run - 42 seconds
    [test_sqlite.py]=1 # it fails on its own
    [test_startfile.py]=1 # it fails on its own
    [test_struct.py]=1 # "if and" confused for if .. assert and
    [test_sunaudiodev.py]=1 # it fails on its own
    [test_support.py]=1 # it fails on its own
    [test_tcl.py]=1 # it fails on its own
    [test_threading.py]=1 # test takes too long to run: 11 seconds
    [test_thread.py]=1 # test takes too long to run: 36 seconds
    [test_trace.py]=1  # Line numbers are expected to be different
    [test_urllib2net.py]=1 # is interactive?
    [test_urllibnet.py]=1 # it fails on its own
    [test_winreg.py]=1 # it fails on its own
    [test_winsound.py]=1 # it fails on its own
    [test_zipfile64.py]=1  # Runs ok but takes 204 seconds
    [test_zlib]=1  # fails on its own
)
# About 265 tests in 14 minutes

if (( BATCH )) ; then
    SKIP_TESTS[test_doctest.py]=1 # Fails on ppc64le
fi