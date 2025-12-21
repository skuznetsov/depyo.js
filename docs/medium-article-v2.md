# Understanding Python Bytecode and Decompilation: A Comprehensive Guide

*From Python 1.0 to 3.14 — A Journey Through 30 Years of Bytecode Evolution*

---

## Introduction

Every Python file you run goes through a hidden transformation. Your elegant, readable code becomes something else entirely — a stream of bytes that only the Python Virtual Machine understands. This bytecode is everywhere: in `.pyc` files, in frozen executables, in that legacy system nobody dares to touch.

**Why should you care?**

- **Security researchers** analyze malware that ships as bytecode-only
- **Developers** recover lost source code from production artifacts
- **Reverse engineers** understand obfuscated applications
- **Curious minds** want to see how Python *really* works under the hood

The challenge? Python's bytecode has evolved dramatically across 30+ years. What worked for Python 2.7 fails spectacularly on 3.11. New features like pattern matching and exception groups introduced entirely new instruction sets. Most decompilers gave up somewhere along the way.

This article explores the principles behind bytecode decompilation — how we can reconstruct source code by simulating what the Python VM does, instruction by instruction. We'll examine both the elegant simplicity of basic operations and the mind-bending complexity of modern Python features.

All examples use [depyo.js](https://github.com/skuznetsov/depyo.js), a decompiler I've been developing since 2010 that now supports **Python 1.0 through 3.14** — likely the widest version coverage of any active decompiler.

---

## Part 1: The Anatomy of Python Bytecode

### What Is Bytecode?

Python bytecode is an intermediate representation — lower-level than source code, but higher-level than machine code. It's designed to be:

- **Portable** across platforms (the same `.pyc` runs on Windows, Linux, macOS)
- **Compact** compared to source (no comments, no formatting)
- **Fast to interpret** by the Python Virtual Machine

Each instruction is an *opcode* (operation code) optionally followed by arguments. The VM maintains a *stack* where intermediate values live during execution.

### Bytecode Structure: Then and Now

Here's where it gets interesting. Python's bytecode format has changed significantly:

| Python Version | Instruction Size | Argument Encoding |
|----------------|------------------|-------------------|
| 1.0 - 3.5      | 1 or 3 bytes     | 2-byte little-endian |
| 3.6+           | 2 bytes (word-aligned) | 1-byte + EXTENDED_ARG |
| 3.11+          | 2 bytes + inline cache | Adaptive specialization |

**Python 2.x example:**
```
LOAD_CONST 2        # 3 bytes: opcode + 2-byte argument
BUILD_CLASS         # 1 byte: opcode only
```

**Python 3.6+ example:**
```
LOAD_CONST 2        # 2 bytes: opcode + 1-byte argument
CACHE               # 2 bytes: inline cache slot (3.11+)
```

**Python 3.11+ added inline caching** — instructions like `LOAD_ATTR` are followed by cache entries that the interpreter uses for optimization. A decompiler must skip these or produce garbage.

### The Argument Problem

When an argument exceeds 255 (in 3.6+) or 65535 (in older versions), Python uses `EXTENDED_ARG`:

```python
# A function with 300 local variables
EXTENDED_ARG 1          # High byte = 1
LOAD_FAST 44            # Low byte = 44, actual index = 1*256 + 44 = 300
```

This seems simple until you realize `EXTENDED_ARG` can be *chained* for values up to 2^32. A decompiler must accumulate these prefixes correctly.

---

## Part 2: The Simulation Principle

### Core Insight: Execute to Understand

The fundamental principle of our decompilation approach:

> **Simulate the bytecode execution, but instead of computing values, build source code fragments on the stack.**

When the VM executes `BINARY_ADD`, it pops two values, adds them, and pushes the result. Our decompiler does the same — but with strings:

```javascript
case 'BINARY_ADD':
    const right = stack.pop();  // "9"
    const left = stack.pop();   // "var_a"
    stack.push(`${left} + ${right}`);  // "var_a + 9"
    break;
```

### A Complete Example

Consider this Python code:

```python
var_a = 1
var_b = var_a + 9
```

Python compiles it to:

```
LOAD_CONST   1        # Push constant 1
STORE_FAST   0        # Store in var_a (index 0)
LOAD_FAST    0        # Push var_a's value
LOAD_CONST   2        # Push constant 9
BINARY_ADD            # Add top two stack items
STORE_FAST   1        # Store in var_b (index 1)
```

Our decompiler traces through:

| Step | Instruction | Stack After | Notes |
|------|-------------|-------------|-------|
| 1 | LOAD_CONST 1 | `["1"]` | Push literal |
| 2 | STORE_FAST 0 | `[]` | Emit: `var_a = 1` |
| 3 | LOAD_FAST 0 | `["var_a"]` | Push variable name |
| 4 | LOAD_CONST 2 | `["var_a", "9"]` | Push literal |
| 5 | BINARY_ADD | `["var_a + 9"]` | Combine with operator |
| 6 | STORE_FAST 1 | `[]` | Emit: `var_b = var_a + 9` |

The result is syntactically correct Python that captures the original semantics.

---

## Part 3: Control Flow — Where It Gets Hard

### The Jump Puzzle

Bytecode uses jumps for all control flow. The same `POP_JUMP_IF_FALSE` instruction can represent:

- An `if` statement
- A `while` loop condition
- Part of a boolean `and`/`or` expression
- A list comprehension filter
- A pattern matching guard (Python 3.10+)

**How do we tell them apart?**

Context. We analyze:
1. What instructions came before
2. What the jump target points to
3. What block structure we're currently inside
4. The line number table (which instructions share a source line)

### Recovering IF/ELSE

```python
if condition:
    do_something()
else:
    do_other()
```

Compiles to:

```
...condition...
POP_JUMP_IF_FALSE  else_label
...if body...
JUMP_FORWARD       end_label
else_label:
...else body...
end_label:
```

The algorithm:
1. Find `POP_JUMP_IF_FALSE` — its target is `else_label`
2. Scan backward from `else_label` for `JUMP_FORWARD` — its target is `end_label`
3. If `end_label > else_label`, we have an else block
4. Recursively decompile each block within its boundaries

### The Optimization Nightmare

Python's peephole optimizer transforms bytecode in ways that break naive analysis:

```python
for elem in items:
    if not is_valid(elem):
        raise Error(elem)
```

You'd expect the jump at the end of the if-block to go forward to the loop continuation. Instead, Python optimizes it to jump *backward* directly to `FOR_ITER`:

```
FOR_ITER          end_loop
STORE_FAST        elem
...condition...
POP_JUMP_IF_TRUE  FOR_ITER  # Backward jump!
...raise...
JUMP_ABSOLUTE     FOR_ITER  # Another backward jump!
end_loop:
```

A decompiler must recognize these patterns and reconstruct the original structure despite the transformations.

---

## Part 4: Modern Python Challenges

### Python 3.10: Pattern Matching

Pattern matching introduced entirely new opcodes:

```python
match command:
    case ["quit"]:
        exit()
    case ["load", filename]:
        load(filename)
    case _:
        unknown()
```

The bytecode uses:
- `MATCH_SEQUENCE` — check if subject is a sequence
- `MATCH_MAPPING` — check if subject is a mapping
- `MATCH_CLASS` — check if subject is an instance
- `MATCH_KEYS` — extract values for specific keys
- `COPY` — duplicate stack items for multiple tests

**The trap:** Before 3.10, certain bytecode patterns (like chained comparisons `0 <= x <= 10`) produce instruction sequences that *look like* pattern matching setup. A decompiler must check the Python version before interpreting these as `match` statements.

### Python 3.11: Exception Groups

```python
try:
    async with trio.open_nursery() as nursery:
        nursery.start_soon(task1)
        nursery.start_soon(task2)
except* ValueError as eg:
    handle_value_errors(eg)
except* TypeError as eg:
    handle_type_errors(eg)
```

New opcodes: `PUSH_EXC_INFO`, `CHECK_EG_MATCH`, `PREP_RERAISE_STAR`

The exception table format also changed from a simple list to a complex structure with depth tracking for nested exception handlers.

### Python 3.12: Inline Comprehensions (PEP 709)

This is perhaps the most disruptive change for decompilers. Previously:

```python
result = [x*2 for x in items]
```

Created a *separate code object* for the comprehension — easy to identify and decompile.

In 3.12+, comprehensions are *inlined* into the parent function:

```
GET_ITER
LOAD_FAST_AND_CLEAR  .0
SWAP                 2
BUILD_LIST           0
SWAP                 2
FOR_ITER             cleanup
STORE_FAST           x
LOAD_FAST            x
BINARY_OP            5 (*)
LOAD_CONST           2
LIST_APPEND          2
JUMP_BACKWARD        FOR_ITER
cleanup:
SWAP                 2
STORE_FAST           .0
RETURN_VALUE
```

There's no clear "this is a comprehension" marker. The decompiler must recognize the *pattern* of `GET_ITER`, loop, `LIST_APPEND`, and cleanup, then reconstruct the comprehension syntax. Current limitation: depyo.js decompiles these as equivalent for-loops, which is semantically correct but less elegant.

### Python 3.13-3.14: The JIT Era

Python 3.13 introduced an experimental JIT compiler. While the bytecode format remains similar, new specialization opcodes appear:

- `BINARY_OP_ADD_INT` — optimized integer addition
- `LOAD_ATTR_INSTANCE_VALUE` — optimized attribute access
- Tier 2 micro-ops for the JIT

Decompilers must map these specialized opcodes back to their generic forms.

---

## Part 5: The Architecture of a Decompiler

### Three-Phase Approach

```
                    ┌─────────────┐
    .pyc file  ───▶ │   Reader    │ ───▶  Code Object Tree
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
    Code Object ───▶│ Decompiler  │ ───▶  AST
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
        AST    ───▶ │  Renderer   │ ───▶  Source Code
                    └─────────────┘
```

**Phase 1: Reader**
- Parse the `.pyc` magic number to determine Python version
- Unmarshal the code object tree (nested functions, classes, comprehensions)
- Handle version-specific marshalling differences

**Phase 2: Decompiler**
- Simulate bytecode execution with AST nodes instead of values
- Build control flow structure (blocks, conditions, loops)
- Handle version-specific opcodes and patterns

**Phase 3: Renderer**
- Convert AST to source code with proper indentation
- Apply version-appropriate syntax (print function vs statement, etc.)
- Preserve line structure using the line number table

### The Stack Is Everything

The execution stack isn't just for values — it's for partial expressions:

```javascript
// Building: func(a, b, *args, **kwargs)
stack: [
  ASTName("func"),
  ASTName("a"),
  ASTName("b"),
  ASTUnpack(ASTName("args")),     // *args
  ASTDictUnpack(ASTName("kwargs")) // **kwargs
]

// CALL_FUNCTION_EX pops all, creates:
ASTCall(func, [a, b], args, kwargs)
```

Each AST node carries:
- The source line number (from the line table)
- References to child nodes
- Rendering logic for different Python versions

---

## Part 6: Practical Applications

### Malware Analysis

Python-based malware often ships as `.pyc` only:

```bash
$ depyo suspicious.pyc
# Reveals: crypto miner hidden in apparent utility
```

### Legacy Code Recovery

That critical system running Python 2.4 with no source control:

```bash
$ depyo --basedir recovered/ legacy_app/*.pyc
# Reconstructs the entire codebase
```

### Understanding Obfuscation

Commercial Python applications often use bytecode-level obfuscation:

```bash
$ depyo obfuscated.pyc
# Even with mangled names, the logic becomes clear
```

### Educational Deep-Dives

Want to understand how decorators, generators, or async/await *really* work?

```bash
$ depyo --asm mycode.pyc
# See both the bytecode and reconstructed source
```

---

## Conclusion

Decompiling Python bytecode is a fascinating puzzle. Each Python version adds new pieces, new patterns, new challenges. The core principle — simulate execution, build source fragments — remains constant, but the implementation must evolve continuously.

The arms race between bytecode evolution and decompilation tools benefits everyone:
- **Language developers** get feedback on bytecode complexity
- **Security researchers** maintain analysis capabilities
- **The community** gains deeper understanding of Python internals

[depyo.js](https://github.com/skuznetsov/depyo.js) represents 14 years of accumulated knowledge about Python bytecode across 30+ versions. It's open source, written in JavaScript for easy modification, and actively maintained.

**Try it yourself:**

```bash
npm install -g depyo
depyo your_file.pyc
```

---

## What's Next

In the next article, we'll dive deep into:
- **Comprehension recovery** — the most elegant Python construct, the hardest to decompile
- **Exception handling** — try/except/else/finally block reconstruction
- **Async/await** — coroutines and their bytecode representation

---

*Sergey Kuznetsov is a software architect specializing in programming language internals and reverse engineering. The depyo.js project is available at [github.com/skuznetsov/depyo.js](https://github.com/skuznetsov/depyo.js).*
