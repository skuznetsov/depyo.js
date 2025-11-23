# Python 3.9+ Support Status Report

## Executive Summary

**Current Status:** Decompiler supports Python 1.0-3.14 with broad feature coverage.
**Gap:** Python 3.9-3.14 have residual gaps in formatting controls and matrix coverage, but core features (walrus, f-strings, pattern matching, exception groups, PEP 695 type params/aliases) are implemented.

**Test Results:** Fixtures green for exception groups/notes (3.11–3.13). Matrix runner available (`scripts/run-matrix.js`) and bench runner (`scripts/bench-fixtures.js`).

---

## Critical Missing Features (Priority 1)

### 1. ✅ Walrus Operator `:=` (Python 3.8 - PEP 572)
Implemented: `NAMED_EXPR` handler, `ASTNamedExpr` across statements/comprehensions/args.

### 2. ✅ f-strings (Python 3.6+)
Implemented: `ASTJoinedStr`/`ASTFormattedValue` with format specs, nesting, `{x=}`.

### 3. ✅ match/case Statements (Python 3.10 - PEP 634)
Implemented: `ASTMatch`/`ASTCase`, OR/mapping/class patterns, guards.

### 4. ✅ Exception Groups (Python 3.11 - PEP 654)
Implemented: `except*`, `PREP_RERAISE_STAR`, `PUSH_EXC_INFO`, `CHECK_EG_MATCH`; fixtures 3.11–3.13 green.

### 5. ✅ Type Parameters / Type Statements (Python 3.12 - PEP 695)
Implemented: extraction of `__type_params__`, CALL_INTRINSIC handling, type aliases/parameters, generics cleanup.

---

## Medium Priority Issues

### 6. ⚠️ Positional-Only Parameters (Python 3.8 - PEP 570)

**Status:** NEEDS TESTING
```python
def greet(name, /, greeting="Hello"):
    return f"{greeting}, {name}!"
```

**Implementation:** Likely stored in code object metadata, not bytecode.

---

### 7. ⚠️ Dict Merge Operators `|` and `|=` (Python 3.9 - PEP 584)

**Status:** NEEDS TESTING
**Opcodes:**
- `DICT_MERGE` (opcode 164 in Python 3.9)
- `DICT_UPDATE` (opcode 165 in Python 3.9)

---

### 8. ⚠️ Union Type Syntax `int | str` (Python 3.10 - PEP 604)

**Status:** NEEDS TESTING
**Opcodes:**
- `BINARY_OP` with union operation

---

## Low Priority Issues

### 9. ⚠️ Parenthesized Context Managers (Python 3.10)

```python
with (open("file1") as f1, open("file2") as f2):
    pass
```

---

### 10. ⚠️ Underscores in Numeric Literals (Python 3.6)

```python
million = 1_000_000
```
**Note:** These are compiled away - the bytecode just has `1000000`.

---

## Bytecode Changes by Version

### Python 3.8
- Removed: `SETUP_LOOP` (120) ✅ Already handled
- Removed: `SETUP_EXCEPT` (121) ✅ Already handled
- Added: Exception tables ✅ Already handled
- Added: `NAMED_EXPR` (132) ❌ **MISSING**

### Python 3.9
- Added: `DICT_MERGE` (164) ❌ **MISSING**
- Added: `DICT_UPDATE` (165) ❌ **MISSING**
- Removed: `BUILD_MAP_UNPACK`
- Removed: `BUILD_MAP_UNPACK_WITH_CALL`

### Python 3.10
- Added: `MATCH_*` opcodes (161-165) ❌ **MISSING**
- Added: `COPY` (166) ⚠️ **NEEDS TESTING**
- Added: `BINARY_OP` (166) ⚠️ **NEEDS TESTING**
- Changed: `GEN_START` opcode

### Python 3.11
- Major reorganization: Adaptive specialized opcodes
- Added: `PRECALL` (166) ⚠️ **NEEDS TESTING**
- Added: `CALL` (171) ⚠️ **NEEDS TESTING**
- Changed: `RESUME` (151) ⚠️ **NEEDS TESTING**
- Added: Exception group opcodes ❌ **MISSING**
- Changed: Exception table format ⚠️ **NEEDS TESTING**

### Python 3.12
- Added: `LOAD_SUPER_ATTR` (176) ⚠️ **NEEDS TESTING**
- Added: Type parameter opcodes ❌ **MISSING**
- Changed: `type` statement handling

### Python 3.13
- Added: `END_FOR` (4) ✅ Already handled
- Added: `LOAD_FAST_BORROW` (130) ✅ Already handled
- Added: `LOAD_SMALL_INT` (131) ✅ Already handled
- Free-threaded bytecode changes ⚠️ **NEEDS RESEARCH**

### Python 3.14 (In Development)
- JIT compiler implications ⚠️ **NEEDS RESEARCH**
- New opcodes from PEPs in progress ⚠️ **NEEDS RESEARCH**

---

## Implementation Roadmap

### Phase 1: Critical Features (Weeks 1-2)
1. **f-strings** - Complete `ASTJoinedStr` implementation
2. **Walrus operator** - Add `NAMED_EXPR` handler
3. **match/case** - Full pattern matching support

### Phase 2: High Priority (Weeks 3-4)
4. **Dict merge operators** - Add `DICT_MERGE`/`DICT_UPDATE` handlers
5. **Exception groups** - Add `except*` support
6. **Type parameters** - Add Python 3.12 type param support

### Phase 3: Testing & Validation (Week 5)
7. Test all Python 3.9-3.13 features
8. Create comprehensive test suite
9. Verify 100% coverage for all versions

### Phase 4: Python 4 Preparation (Week 6)
10. Research upcoming PEPs
11. Monitor bytecode format changes
12. Prepare for breaking changes

---

## Testing Status

### Test Files Generated: 48
- Python 3.9: 15 test files ✓
- Python 3.10: 5 test files ✓
- Python 3.11: 7 test files ✓
- Python 3.12: 10 test files ✓
- Python 3.13: 11 test files ✓

### Decompilation Results
- ✅ Python 3.0-3.8: **100% error-free**
- ❌ Python 3.9-3.13: **Multiple critical failures**

---

## Recommendations

1. **Immediate Action Required:**
   - Implement f-strings (affects all Python 3.6+ code)
   - Implement walrus operator (affects all Python 3.8+ code)
   - Implement match/case (affects all Python 3.10+ code)

2. **Testing Strategy:**
   - Use generated test files in `test/modern_features/`
   - Compile with multiple Python versions
   - Verify decompilation matches source

3. **Python 4 Preparation:**
   - Monitor python-dev mailing list
   - Track PEPs for Python 4.0
   - Watch for bytecode format changes
   - Plan for potential breaking changes in opcode numbering

---

## References

- PEP 572: Assignment Expressions (Walrus Operator)
- PEP 498: Literal String Interpolation (f-strings)
- PEP 634: Structural Pattern Matching
- PEP 654: Exception Groups and except*
- PEP 695: Type Parameter Syntax
- Python Bytecode Changes: https://docs.python.org/3/whatsnew/

---

**Last Updated:** 2025-01-10
**Next Review:** After implementing Phase 1 features
