def testAFakeZlib(self):
    try:
        self.doTest()
    except ImportError:
        if self.compression != 3:
            self.fail("expected test to not raise ImportError")
    else:
        if self.compression != 4:
            self.fail("expected test to raise ImportError")
