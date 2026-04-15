def testit(stmts):
    x = 1
    results = []
    
    for stmt in stmts:
        try:
            x = eval(stmt)
        except SyntaxError:
            results.append(1)
        results.append(x)
    
    return results

results = testit(["1 + 2", "1 +"])
assert results == [3, 1], "try with else failed"
