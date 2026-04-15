# depyo fix plan

Derived from hostile review 2026-04-14. Ordered to maximize feedback quality per hour of work.

## Phase 0 — Correctness oracle (infrastructure) ✓ DONE

**Why first:** Without a correctness oracle, every fix is blind — snapshots will "break" after correct fixes and "pass" after broken ones. A cheap two-tier oracle gives real signal.

- [x] **0.1** `scripts/check-parseable.js` — Tier-1 oracle, Python `ast.parse` validates each decompiled `.py`. Baseline at `scripts/baselines/parseable.txt` (348 entries / 538 pass / 883 total).
- [x] **0.2** `scripts/check-ast-equivalence.js` — Tier-2 oracle, AST(source) vs AST(decompiled). Baseline at `scripts/baselines/ast-equivalence.txt` (713 entries / 143 pass / 853 compared / 30 no-oracle).
- [x] **0.3** All three oracles wired into CI. Sentinel check is GATING; Tier-1 and Tier-2 are informational (continue-on-error) until baselines are worked down.
- [x] **0.4** `scripts/check-no-sentinels.js` — sentinel scanner. Baseline at `scripts/baselines/sentinels.txt` (44 entries). Gating in CI.

**Numbers to beat:**
- Sentinel violators: 44 → 0
- Tier-1 syntax failures: 348 → 0
- Tier-2 AST mismatches: 710 → 0 (143/853 = 17% currently semantically correct)

## Phase 1 — Stop the bleeding (small, high-value)

- [ ] **1.1** `PycDecompiler.js:746-753`: swallow + continue → accumulate errors, emit non-zero exit code at end of run. Log per-opcode but fail overall. Add `--strict` for throw-on-first.
- [ ] **1.2** `code_reader.js:62-74`: remove `debugger`, throw on malformed input.
- [ ] **1.3** Replace `"###FIXME###"` fallbacks in `lib/handlers/context_managers.js` (3 places) and `lib/handlers/exceptions_blocks.js` (5 places) with explicit throws that include opcode offset + file.
- [ ] **1.4** Replace `#TODO ${this.constructor.name}` default in `ASTNode.codeFragment()` (`lib/ast/ast_node.js:53-58`) with throw.
- [ ] **1.5** Replace `#TODO pattern` in `ASTPattern.codeFragment()` (`lib/ast/ast_node.js:3388`) with throw.
- [ ] **1.6** CI: remove `continue-on-error: true` on legacy versions. Remove `|| true` on `.github/workflows/ci.yml:36`. Make failures visible.

**Exit criteria:** `check-no-sentinels.js` passes; CI fails loudly on any decompile error.

## Phase 2 — Function annotation bug (high-impact, localized)

- [ ] **2.1** Read `lib/handlers/function_class_build.js` MAKE_FUNCTION flag handling. Identify where annotation dict (flag 0x04) is attached.
- [ ] **2.2** Read `lib/ast/ast_node.js` args rendering (likely `ASTFunction.codeFragment` or argspec area).
- [ ] **2.3** Write minimal native-3.7 fixture with typed function.
- [ ] **2.4** Fix the conflation between annotation dict and default tuple.
- [ ] **2.5** Regenerate all affected snapshots via AST-equivalence check (they should NOW emit `def f(x: int) -> int` form).

**Exit criteria:** AST-equivalence passes for every typed function fixture 3.7+.

## Phase 3 — Decorator rendering (medium-impact)

- [ ] **3.1** Locate `##ERROR_DECORATOR##` fallback in `lib/ast/ast_node.js` (~line 934). Identify when decorator expression doesn't resolve.
- [ ] **3.2** Fix complex decorator expressions (attribute access, calls with args).
- [ ] **3.3** Fix `#TODO ASTClass` leak in class decorator path.
- [ ] **3.4** Add fixtures: `@typing.override`, `@functools.total_ordering` on class, `@deprecated("msg")` with args on method.

## Phase 4 — Async comprehensions (SoTA harvest needed)

- [ ] **4.1** Study CPython source: how does `[x async for x in aiter()]` compile? Read `compile.c` comprehension codegen for async path. Document expected bytecode pattern.
- [ ] **4.2** Review `lib/handlers/generators_async.js` + comprehension reconstruction in `lib/handlers/loop_iterator.js`.
- [ ] **4.3** Implement async-for comprehension node; integrate with existing comprehension detection.
- [ ] **4.4** Fixtures: list/set/dict/gen async comprehensions.

## Phase 5 — Match/case rewrite (largest, may defer)

**Defer gate:** If Phase 0 oracle shows match/case output is valid Python (just wrong semantics), document as known-bad and defer. Reopen when user prioritizes.

- [ ] **5.1** SoTA harvest: study CPython `compile.c` match-statement codegen and existing decompilers' approaches (decompyle3, pycdc).
- [ ] **5.2** CFG analysis: correctly identify guard jumps, pattern fallthroughs, capture bindings.
- [ ] **5.3** Rewrite `lib/handlers/pattern_matching.js` with explicit state machine per pattern type.
- [ ] **5.4** Regenerate and manually verify all 3.10+ match fixtures.

## Phase 6 — Coverage gaps (new fixtures)

After Phases 0-3 land, add native fixtures for each gap in `project_feature_gaps.md`:
- 3.6 underscores, async generators
- 3.7 dataclass, `breakpoint()`, `__future__ annotations`
- 3.8 native walrus / pos-only / f"{x=}"
- 3.9 decorator grammar
- 3.10 paren-`with`
- 3.11 TaskGroup (stdlib-only, low priority), TypeVarTuple
- 3.12 nested f-strings, PEP 688
- 3.13 PEP 696 TypeVar defaults, PEP 705 ReadOnly, PEP 667 locals
- 3.14 PEP 758 paren-except, PEP 649 deferred annotations

## Phase 7 — Infrastructure cleanup

- [ ] **7.1** Split `lib/ast/ast_node.js` (3400 LOC) by AST node category.
- [ ] **7.2** Extract intrinsic IDs to enum in `lib/intrinsics.js`, remove magic numbers from handlers.
- [ ] **7.3** Fix auto-handler regex `PycDecompiler.js:101-103` to handle `ABC`/`IRQ`-style names OR switch to explicit registration map.
- [ ] **7.4** Populate missing magic number revisions in `PycReader.js` — cross-ref CPython `Lib/importlib/_bootstrap_external.py` per minor line.

## Sequencing rationale

- **Phase 0 gates everything.** Without correctness oracle, later phases are blind.
- **Phase 1 is cheap and prevents new rot** — should finish in hours.
- **Phases 2-3** give immediate user-visible quality jump with localized risk.
- **Phase 4** requires research → allocate a block, not interleave.
- **Phase 5** is large + research-heavy → explicit defer option.
- **Phase 6** depends on Phase 0-3 being solid, otherwise new fixtures just capture more broken output.
- **Phase 7** is non-urgent refactor; don't block features on it.
