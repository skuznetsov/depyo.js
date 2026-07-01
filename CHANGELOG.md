# Changelog

All notable changes to depyo (the Node.js port) are documented here. The Python
port (`depyo` on PyPI, https://github.com/skuznetsov/depyo.py) tracks the same
version numbers and the same fixes.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [1.2.9] - 2026-07-01

### Fixed
- **Chained-compare guard duplicated its body on 3.10–3.12** (depyo.js #14):
  `if not a < x < b: raise ...` (and `if a < x < b: return ...`) emitted the
  `raise`/`return` twice, because CPython 3.10–3.12 physically copy the block
  tail into the chain's short-circuit exit. The dead copy is now recognised and
  dropped, so the guard renders once on 3.9–3.14.

### Known issues
- `while a < x < b:` still reconstructs as an `if` on 3.10–3.12 — that's the
  3.12+ duplicated-condition (`while` → do-while + entry guard) loop shape, a
  separate reconstruction problem tracked in #14.

## [1.2.8] - 2026-06-30

### Fixed
- **Chained comparisons in conditions** (depyo.js #14): `if a < x < b:` /
  `if a < x < b < c:` were misreconstructed on every Python version — the body
  was hoisted out (3.9), the whole thing was misdetected as a `match` statement
  (3.10), the condition was truncated to `x < b` (3.11), a spurious `else`
  appeared (3.12), or it rendered as `a < x or x < b` (3.13/3.14). Now folds the
  value-share prefix and consumes the cleanup epilogue so `if`/`while` chained
  comparisons reconstruct correctly across 3.9–3.14.
- **`elif` over-fire**: two independent consecutive `if`s with a fall-through
  first body (`if a: x = 1` followed by `if b: y = 1`) were collapsed into
  `if a: ... elif b: ...`, changing the semantics. `elif` is now only emitted
  when the prior `if` body leaves via a terminator (`return`/`raise`) or an
  unconditional jump. Corrects ~35 stdlib snapshots (Python 1.0–3.8).
- **Ternary over-fire**: `if cond: foo()` followed by `return x` was collapsed
  into the invalid `foo() if cond else x` (dropping the `return`). Removed the
  dead reconstruction branch responsible.

### Known issues
- CPython 3.10–3.12 physically duplicate a block's tail into each exit; as a
  result `if not a < x < b: raise ...` (3.10/3.12) and some `while a < x < b:`
  loops still reconstruct with a duplicated statement. Tracked in #14 as a
  separate, general tail-deduplication problem.

## [1.2.7] - 2026-06-28

### Fixed
- **`bunx depyo file.pyc` crash** `Don't know how to handle object Type 'e'`
  (depyo.js #13): the marshal reader over-read `TYPE_LONG` integers whose
  15-bit-digit count was even and ≥ 4 (e.g. `1 << 48` in `uuid.py`), desyncing
  the whole stream. Fixed the digit-count arithmetic; also fixed `Py_VeryLong`
  rendering (`1 << 32` printed as `0,4`) and a dropped sign on negative longs.
- **`if`-statement control-flow** across 3.9–3.14: `if not X: raise SomeError()`
  no longer collapses into `assert X` (which changed the exception type);
  single-statement `if` bodies are no longer hoisted out on 3.13/3.14; `if cond:
  raise/return X` no longer renders as an invalid ternary on 3.12–3.14; and 3.14
  `assert` no longer renders `raise None` (`LOAD_COMMON_CONSTANT` is now mapped
  to `AssertionError`/`NotImplementedError`).

## [1.2.6] - 2026-06-05

### Fixed
- **Free/cell variable names on 3.11+** (depyo.py #5): the flat
  `co_localsplusnames` layout was indexed incorrectly when a parameter was also
  captured by a closure, producing wrong names or `##FREEVAR_n##` (e.g. an
  `import c` inside a closure decompiled as `import c as a`).
- **Short-circuit boolean chains on 3.10+** (depyo.py #6): `return b and c` was
  reconstructed as an empty `if` block plus a bare `return`, because the
  `JUMP_IF_*_OR_POP` / `COPY`+`POP_JUMP` chain shapes were not recognized.

## [1.2.5] - 2026-05-24

### Fixed
- `lambda: None` crashed decompilation, and lambda bodies could render as
  `pass` (depyo.py #12).

## [1.2.4] - 2026-05-22

### Fixed
- Bogus `if cond: return x` → `return cond and x` folding, which dropped the
  fall-through return path when `x` was falsy (depyo.py #3).
- Garbled non-ASCII output and file writing on Windows — text output is now
  forced to UTF-8 (depyo.py #2, Python port).
