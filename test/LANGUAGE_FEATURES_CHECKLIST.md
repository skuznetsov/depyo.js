# Python Language Features Coverage Checklist

## Core Language Features by Version

### Python 3.0-3.5 (Already Tested)
- [x] Basic syntax (assignments, operators, literals)
- [x] Control flow (if/elif/else, for, while, break, continue)
- [x] Functions (def, return, parameters, *args, **kwargs)
- [x] Classes (class, inheritance, __init__, methods)
- [x] Exception handling (try/except/finally/else, raise)
- [x] With statement (context managers)
- [x] List/dict/set comprehensions
- [x] Generator expressions
- [x] Decorators (@decorator)
- [x] Lambda functions
- [x] Global/nonlocal
- [x] Import statements (import, from...import, import...as)
- [x] Assert statements
- [x] Del statements
- [x] Pass/break/continue
- [x] Yield (generators)
- [x] Print function (Python 3+)
- [x] Slicing operations
- [x] Unpacking assignments

### Python 3.5 (PEP 492 - Async/Await)
- [x] async def (async functions)
- [x] await expressions
- [x] async for loops
- [x] async with statements
- [ ] **NEEDS TESTING**: Async comprehensions

### Python 3.6 (Format Strings)
- [ ] **MISSING**: f-strings (f"Hello {name}")
- [x] Variable annotations (x: int = 5)
- [ ] **MISSING**: Underscores in numeric literals (1_000_000)
- [ ] **MISSING**: Asynchronous generators (async def with yield)

### Python 3.7
- [ ] **MISSING**: Dataclasses (@dataclass)
- [x] Postponed annotation evaluation (from __future__ import annotations)

### Python 3.8 (PEP 572 - Walrus Operator)
- [ ] **CRITICAL**: := (walrus operator / assignment expressions)
- [ ] **MISSING**: Positional-only parameters (def f(a, b, /, c))
- [ ] **MISSING**: f-string = debugging (f"{var=}")

### Python 3.9 (PEP 584, 585, 614)
- [ ] **MISSING**: Dict merge operators (| and |=)
- [ ] **MISSING**: Type hint generics (list[int] instead of List[int])
- [ ] **MISSING**: Decorators on any expression
- [ ] **MISSING**: str.removeprefix() / str.removesuffix()

### Python 3.10 (PEP 634 - Pattern Matching)
- [ ] **CRITICAL**: match/case statements (structural pattern matching)
- [ ] **MISSING**: Pattern matching with classes
- [ ] **MISSING**: Pattern matching with sequences
- [ ] **MISSING**: Pattern matching with mappings
- [ ] **MISSING**: Pattern matching with wildcards
- [ ] **MISSING**: Parenthesized context managers (with (a, b):)
- [ ] **MISSING**: Union types with | (int | str)

### Python 3.11 (PEP 654, 680, 678)
- [ ] **CRITICAL**: Exception groups (ExceptionGroup)
- [ ] **CRITICAL**: except* (catching exception groups)
- [ ] **MISSING**: TaskGroup (asyncio)
- [ ] **MISSING**: TOML support (tomllib)
- [ ] **MISSING**: Variadic generics

### Python 3.12 (PEP 701, 692, 695, 698)
- [ ] **CRITICAL**: Type parameter syntax (def func[T](x: T))
- [ ] **CRITICAL**: type statement (type Point = tuple[float, float])
- [ ] **MISSING**: f-string improvements (nested quotes, multi-line)
- [ ] **MISSING**: Per-interpreter GIL
- [ ] **MISSING**: @override decorator

### Python 3.13 (PEP 703, 719, 594)
- [ ] **CRITICAL**: Free-threaded Python (no GIL) bytecode changes
- [ ] **MISSING**: Improved error messages in bytecode
- [ ] **MISSING**: Remove deprecated modules

### Python 3.14 (Expected Features)
- [ ] **RESEARCH**: JIT compiler bytecode implications
- [ ] **RESEARCH**: New opcodes from JIT
- [ ] **RESEARCH**: PEPs in development

## Bytecode-Specific Features to Test

### Exception Handling Evolution
- [x] Python 2.x: SETUP_EXCEPT + POP_BLOCK
- [x] Python 3.8+: Exception tables
- [x] Python 3.11+: New exception table format
- [ ] **TEST**: Exception groups (Python 3.11+)

### For Loop Changes
- [x] Python <3.8: SETUP_LOOP + FOR_ITER + POP_BLOCK
- [x] Python 3.8+: FOR_ITER without SETUP_LOOP
- [x] Python 3.13+: END_FOR opcode

### Async Evolution
- [x] Python 3.5: GET_AWAITABLE
- [x] Python 3.5: GET_AITER, GET_ANEXT
- [x] Python 3.11+: END_ASYNC_FOR
- [ ] **TEST**: Async generators properly

### Function Calls
- [x] Python <3.6: CALL_FUNCTION
- [x] Python 3.6+: CALL_FUNCTION_EX
- [x] Python 3.11+: CALL (simplified)
- [ ] **TEST**: Python 3.13+ CALL changes

### Bytecode Optimizations
- [x] Python 3.11: Adaptive bytecode (LOAD_FAST variants)
- [x] Python 3.14: LOAD_FAST_BORROW, LOAD_SMALL_INT
- [ ] **TEST**: All 3.11+ specialized opcodes

## Test File Generation Needed

### Priority 1 (Critical for 3.8+)
1. Walrus operator (x := value)
2. Match/case statements (3.10)
3. Exception groups (3.11)
4. Type parameters (3.12)

### Priority 2 (Important)
1. f-strings
2. Positional-only parameters
3. Dict merge operators
4. Async comprehensions

### Priority 3 (Nice to have)
1. Decorators on expressions
2. Parenthesized context managers
3. Union type syntax (|)

## Python 4 Preparation

### Expected Changes (Research Needed)
- [ ] Research PEP proposals for Python 4
- [ ] Monitor bytecode format changes
- [ ] Watch for breaking changes in opcode IDs
- [ ] Track new syntax features
- [ ] Follow GIL removal implications

## Testing Strategy

1. **Generate test files**: Create .py files for each missing feature
2. **Compile**: Use Python 3.9-3.14 to create .pyc files
3. **Decompile**: Run depyo on generated .pyc files
4. **Verify**: Compare output with source
5. **Fix**: Address any ##ERROR## or ###FIXME### markers

## Coverage Metrics

Current: 1074 test files, versions 1.0-3.8
Missing: **No tests for Python 3.9-3.14**
Target: 100% coverage for all language features up to 3.14
