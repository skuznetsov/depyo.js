def test_iziplongest(self):
    for args in ["abc"]:
        self.assertEqual(1, 2)
    
    for stmt in ["izip_longest('abc', fv=1)"]:
        try:
            eval(stmt)
        except TypeError:
            pass
        self.fail()