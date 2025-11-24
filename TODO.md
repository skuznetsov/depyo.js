## Backlog (1.0–4.0 support)

- Exception fixtures (3.13–3.14): add targeted PREP_RERAISE_STAR/exception-group and SETUP_WITH_A/WITH_EXCEPT_START cases for 3.14; expand instrumented opcode coverage (FORMAT_*, BUILD_TEMPLATE, EXIT_INIT_CHECK) once handlers land.
- Tests/CI: broaden matrix (1.x, 2.x, 3.4, 3.6, 3.8, 3.10, 3.11–3.14) with f-string/walrus/match/EG coverage + diff-normalization harness; integrate matrix runner beyond current py311_exception_groups/notes smoke.

## Done

- Formatting/CLI: add optional “raw spacing” flag to show potential comment gaps; keep default normalized spacing/quoting.
- Exception fixtures: baseline exception-group/note coverage compiled for 3.11–3.13 with matrix runner support.
- Walrus operator (`NAMED_EXPR`): `ASTNamedExpr` and walrus detection across statements/comprehensions/args in place.
- F-strings: `ASTJoinedStr`/`ASTFormattedValue` handle format specs, nesting, and `{x=}` debug forms (FORMAT_VALUE/BUILD_STRING flows).
- Dict/Set updates: LIST_EXTEND/SET_UPDATE/DICT_UPDATE/DICT_MERGE support (const maps, iterable/zipped inputs) with 3.9+ opcode handling.
- Pattern matching: OR-patterns and mapping patterns (MATCH_KEYS/MATCH_MAPPING) reconstructed with preserved key ASTs and guard combination from COMPARE chains.
- Exception plumbing: WITH_EXCEPT_START implemented, PREP_RERAISE_STAR represented via helper call, SETUP_WITH_A handling aligned with context-manager detection.
