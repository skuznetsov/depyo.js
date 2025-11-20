## Backlog (1.0–4.0 support)

- Walrus operator (`NAMED_EXPR`): add `ASTNamedExpr`, handlers for if/while/comprehensions/args; mid: tests for simple/inline walrus.
- F-strings: finish `ASTJoinedStr` with format specs, nested f-strings, `{x=}`; cover FORMAT_VALUE/BUILD_STRING combos.
- Dict/Set updates: handle LIST_EXTEND/DICT_UPDATE/DICT_MERGE/SET_UPDATE with iterables/zip/kwargs; add tests for 3.9+ opcode variants.
- Exception plumbing: implement CALL_FINALLY/SETUP_WITH_A todos; refine PREP_RERAISE_STAR paths with targeted fixtures.
- Pattern matching: add OR-patterns, mapping patterns (MATCH_KEYS/MATCH_MAPPING), stronger guard combination from COMPARE chains.
- Formatting/CLI: add optional “raw spacing” flag to show potential comment gaps; keep default normalized spacing/quoting.
- Tests/CI: per-version fixture suite (1.x, 2.x, 3.4, 3.6, 3.8, 3.10, 3.11–3.14), f-string/walrus/match/eg coverage; diff-normalization harness.
