## Backlog (1.0–4.0 support)

- Dict/Set updates: handle LIST_EXTEND/DICT_UPDATE/DICT_MERGE/SET_UPDATE with iterables/zip/kwargs; add tests for 3.9+ opcode variants.
- Exception plumbing: finish SETUP_WITH_A/WITH_EXCEPT_START edge handling; refine PREP_RERAISE_STAR paths with targeted fixtures.
- Pattern matching: add OR-patterns, mapping patterns (MATCH_KEYS/MATCH_MAPPING), stronger guard combination from COMPARE chains.
- Formatting/CLI: add optional “raw spacing” flag to show potential comment gaps; keep default normalized spacing/quoting.
- Tests/CI: per-version fixture suite (1.x, 2.x, 3.4, 3.6, 3.8, 3.10, 3.11–3.14), f-string/walrus/match/eg coverage; diff-normalization harness.

## Done

- Walrus operator (`NAMED_EXPR`): `ASTNamedExpr` and walrus detection across statements/comprehensions/args in place.
- F-strings: `ASTJoinedStr`/`ASTFormattedValue` handle format specs, nesting, and `{x=}` debug forms (FORMAT_VALUE/BUILD_STRING flows).
