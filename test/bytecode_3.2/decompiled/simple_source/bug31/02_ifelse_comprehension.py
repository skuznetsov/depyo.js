def _extend_values_for_multiparams(compiler, stmt, c):
    c(([(None if compiler() else compiler() if c in stmt else compiler())] for i in enumerate(stmt)))
