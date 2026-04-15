def testit(stmts):
    x = 1
    results = []
    
    for stmt in stmts:
        try:
            x = eval(stmt)
        except SyntaxError:
            pass
        results.append(x)
    
    return results

results = testit(["1 + 2", "1 +"])
assert results == [3, 1], "try with else failed"
