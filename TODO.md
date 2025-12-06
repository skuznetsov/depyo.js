## Backlog (1.0–4.0 support)

- Exception fixtures (3.13–3.14): targeted PREP_RERAISE_STAR/exception-group reraises and SETUP_WITH_A/WITH_EXCEPT_START_A edges; broaden instrumentation coverage on new 3.14 opcodes; add with+except* coverage (currently only simple with).
- **Cosmetic:** Single `except*` handler shows cleanup code (`e = None; del e; __exception__[[]]`) after handler body. Core decompilation works; cleanup suppression would improve readability.
- Tests/CI: continue expanding matrix coverage for older Python versions (1.x, 2.x, 3.4, 3.6); regenerate expected files for 3.10/3.11 match patterns; add py314_with smoke.

## Done

- Formatting/CLI: add optional "raw spacing" flag to show potential comment gaps; keep default normalized spacing/quoting.
- Exception fixtures: baseline exception-group/note coverage compiled for 3.11–3.13 with matrix runner support.
- 3.14 formatting/exception: BUILD_* formatting handlers added; py314 formatting + exception-group/note fixtures passing.
- 3.14 with: basic context-manager fixture compiled and passing.
- Walrus operator (`NAMED_EXPR`): `ASTNamedExpr` and walrus detection across statements/comprehensions/args in place.
- F-strings: `ASTJoinedStr`/`ASTFormattedValue` handle format specs, nesting, and `{x=}` debug forms (FORMAT_VALUE/BUILD_STRING flows).
- Dict/Set updates: LIST_EXTEND/SET_UPDATE/DICT_UPDATE/DICT_MERGE support (const maps, iterable/zipped inputs) with 3.9+ opcode handling.
- Pattern matching: OR-patterns and mapping patterns (MATCH_KEYS/MATCH_MAPPING) reconstructed with preserved key ASTs and guard combination from COMPARE chains.
- Pattern matching: literal and sequence patterns with capture variables fixed; RETURN handlers properly flush case bodies before new patterns.
- Exception plumbing: WITH_EXCEPT_START implemented, PREP_RERAISE_STAR represented via helper call, SETUP_WITH_A handling aligned with context-manager detection.
- Context managers (3.11+): BEFORE_WITH opcode handler for Python 3.11-3.13; exception table filtering to skip WITH_EXCEPT_START handler regions; proper block closing before cleanup code; nested and multiple context managers (`with A, B:`) supported.
- Context managers (3.14): LOAD_SPECIAL opcode handler with oparg-to-method mapping (__enter__/__exit__/__aenter__/__aexit__); proper with-block creation and return statement preservation.
- Exception groups: Fixed single except* handler producing spurious `except: pass`; JUMP_FORWARD now scans for CHECK_EG_MATCH to distinguish handler chaining from internal cleanup; fixed handleReraise nodes copy (m_nodes).
- Tests/CI: broadened CI matrix to cover f-strings (3.6), walrus (3.8), match patterns (3.12+), exception groups (3.11+); added diff-normalization harness with `--strict` and `--show-diff` flags; modern features smoke test on 3.12.
