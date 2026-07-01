# Changelog

All notable changes to depyo (the Node.js port) are documented here. The Python
port (`depyo` on PyPI, https://github.com/skuznetsov/depyo.py) tracks the same
version numbers and the same fixes.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [1.2.11] - 2026-07-01

### Fixed
- **Compound `while` conditions** (depyo.js #14): `while a and b:` and
  `while a or b:` are now reconstructed across 3.8–3.14. Previously the top-tested
  shape (3.8/3.9/3.13/3.14) rendered `while a or b:` as `if not a: while b:`, and
  the 3.10–3.13 duplicated-condition shape produced the wrong operator, an
  infinite loop, or `if a: while b:` because the detector only read the first
  condition group. A header chain-scan now computes the real body start and exit,
  and each guard folds into the correct `and`/`or` chain by jump-target geometry.
- **`continue` on 3.8–3.14** (depyo.js #14): `while …: … if c: continue` lost the
  `continue` on 3.8–3.10 (a JUMP_ABSOLUTE back to the loop top inside an `if` was
  swallowed, rendering `if c: pass` and hoisting the trailing body out of the
  loop) and on 3.14 (folded into a bogus `x = x % 2 and x + 2`). Both are
  reconstructed now, with `if c: pass` at a loop tail correctly kept distinct from
  a real `continue`.
- **Conditional `break` in `while True:`** (depyo.js #14): `while True: … if c:
  break` on 3.11–3.14 compiles the guard as a single conditional jump straight to
  the loop exit; it rendered as `if not c: pass` and looped forever. Now emitted
  as `if c: break`.
- **3.11 chained-compare crash** (depyo.js #14): a chained comparison inside a
  3.11 `while` hit `POP_JUMP_BACKWARD_IF_TRUE`/`_FALSE`, which had no handler and
  aborted decompilation (`unsupported opcode`, non-zero exit). Handlers added;
  output is now valid best-effort Python.

### Known issues
- `while a < x < b:` (chained comparison inside a `while`) still reconstructs as an
  `if` on 3.10–3.11 (semantically single-iteration); 3.12–3.13 reconstruct it as a
  correct but non-idiomatic nested `while 1: … break`, and 3.14 reconstructs it
  correctly. Full idiomatic reconstruction needs a dedicated chained-compare loop
  detector — a separate reconstruction problem tracked in #14.
- `while True:` with a `break` on 3.8/3.9 still unrolls (the pre-3.10 loop-back is
  a bare `JUMP_ABSOLUTE` with no entry guard, and extending infinite-loop
  detection to 3.8/3.9 regressed async-for/walrus loop shapes) — tracked in #14.

## [1.2.10] - 2026-07-01

### Fixed
- **`while` loops on Python 3.10–3.13** (depyo.js #14): CPython 3.10–3.13 compile
  `while COND:` with a *duplicated* condition (an entry guard plus a copy of the
  condition at the loop bottom), and `while True:` with no entry guard at all —
  neither shape was recognised, so single-condition loops rendered as `if`s with
  a leaked `if COND: pass`, and `while True:` loops were dropped entirely (their
  body leaked to the enclosing scope). Now reconstructed:
  - single-expression conditions — `while x < 100:`, `while x != 0:`,
    `while not done:`, `while i < len(items):` — across 3.9–3.14;
  - `while True:` / infinite loops (with `break`, trailing `return`, and nesting)
    across 3.10–3.13, including 3.11's explicit `JUMP_FORWARD` breaks (previously
    misread as a ternary or a spurious `else`).
- **`break` on 3.11+**: a forward jump out of the enclosing loop is now emitted as
  `break` instead of collapsing into an empty `if …: pass` or a bogus `else`.
- **`continue` on 3.11–3.13**: `while …: … if c: continue` reconstructs correctly
  instead of folding the `continue` into invalid Python
  (`x = x % 2 and x += 10`); a `continue` targeting the loop top is no longer
  mistaken for a `while True:` header.
- **3.14 single-condition `while` regression fixed**: the loop detector no longer
  wraps a 3.14 top-tested `while COND:` in a bogus `while True:` header (which had
  produced `while <error> or COND:`); `while True:` and `while a and b:` also
  reconstruct correctly on 3.14 now.

### Known issues
- On 3.10–3.13, compound loop conditions (`while a and b:`, `while a or b:`),
  chained comparisons inside a `while`, `while … : continue` on 3.10, and
  `while/else` with a `break` still reconstruct imperfectly — each is a separate
  reconstruction problem tracked in #14. (`while/else` *without* a `break`
  compiles identically to a `while` followed by the trailing statements, so it is
  reconstructed as such — a semantically equivalent form.)

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
