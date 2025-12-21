# Python Bytecode Decompilation: Comprehensions, Exceptions, and Async

*Part 2: The Three Pillars of Python Complexity*

---

## Introduction

In [Part 1](link-to-part-1), we explored the fundamentals of Python bytecode and the simulation principle that drives decompilation. We saw how simple expressions become stack operations, and how control flow creates intricate jump patterns.

Now we venture into harder territory. Three Python features that appear elegant in source code become surprisingly complex in bytecode:

1. **Comprehensions** — One line of Python, dozens of bytecode instructions
2. **Exception handling** — Nested try/except/else/finally with cleanup guarantees
3. **Async/await** — Coroutines that pause, resume, and interleave execution

Each presents unique challenges. Each teaches us something profound about how Python actually works.

---

## Part 1: Comprehensions — Elegance Meets Complexity

### The Beauty of Comprehensions

Python comprehensions are beloved for their expressiveness:

```python
# List comprehension
squares = [x**2 for x in range(10) if x % 2 == 0]

# Dict comprehension
word_lengths = {word: len(word) for word in words}

# Set comprehension
unique_chars = {c.lower() for c in text if c.isalpha()}

# Generator expression
sum_of_squares = sum(x**2 for x in range(1000000))

# Nested comprehension
matrix = [[i*j for j in range(5)] for i in range(5)]
```

Each packs iteration, transformation, and filtering into a single expression. But this elegance comes at a cost — the bytecode is anything but simple.

### Pre-3.12: The Hidden Function

Before Python 3.12, every comprehension created a **separate code object** — essentially an anonymous function:

```python
result = [x*2 for x in items]
```

Becomes conceptually:

```python
def <listcomp>(iterator):
    result = []
    for x in iterator:
        result.append(x*2)
    return result

result = <listcomp>(iter(items))
```

The bytecode in the *parent* function:

```
LOAD_CONST          <code object <listcomp>>
LOAD_CONST          '<listcomp>'
MAKE_FUNCTION       0
LOAD_FAST           items
GET_ITER
CALL_FUNCTION       1
STORE_FAST          result
```

The bytecode *inside* the `<listcomp>` code object:

```
BUILD_LIST          0
LOAD_FAST           .0          # The iterator argument
FOR_ITER            end
STORE_FAST          x
LOAD_FAST           x
LOAD_CONST          2
BINARY_MULTIPLY
LIST_APPEND         2           # Append to list 2 levels up
JUMP_ABSOLUTE       FOR_ITER
end:
RETURN_VALUE
```

### The Decompilation Strategy

Recognizing a comprehension requires checking multiple signals:

```javascript
function isComprehension(codeObject) {
    // 1. Name pattern
    if (!['<listcomp>', '<dictcomp>', '<setcomp>', '<genexpr>']
            .includes(codeObject.name)) {
        return false;
    }

    // 2. Single argument named '.0'
    if (codeObject.argCount !== 1 ||
        codeObject.varNames[0] !== '.0') {
        return false;
    }

    // 3. First real instruction is BUILD_LIST/SET/MAP or just iteration
    const firstOp = codeObject.code[0];
    return ['BUILD_LIST', 'BUILD_SET', 'BUILD_MAP', 'LOAD_FAST']
           .includes(firstOp.name);
}
```

Once identified, we decompile the comprehension body and wrap it appropriately:

```javascript
function decompileComprehension(codeObject, iteratorExpr) {
    const type = codeObject.name;  // <listcomp>, etc.
    const body = decompileComprehensionBody(codeObject);

    switch (type) {
        case '<listcomp>':
            return `[${body.expr} for ${body.target} in ${iteratorExpr}${body.condition}]`;
        case '<dictcomp>':
            return `{${body.key}: ${body.value} for ${body.target} in ${iteratorExpr}${body.condition}}`;
        case '<setcomp>':
            return `{${body.expr} for ${body.target} in ${iteratorExpr}${body.condition}}`;
        case '<genexpr>':
            return `(${body.expr} for ${body.target} in ${iteratorExpr}${body.condition})`;
    }
}
```

### Nested Comprehensions

The real challenge is nested comprehensions:

```python
flat = [cell for row in matrix for cell in row if cell > 0]
```

This creates nested loops *within* the comprehension code object:

```
BUILD_LIST          0
LOAD_FAST           .0          # matrix iterator
FOR_ITER            outer_end
STORE_FAST          row
LOAD_FAST           row
GET_ITER
FOR_ITER            inner_end
STORE_FAST          cell
LOAD_FAST           cell
LOAD_CONST          0
COMPARE_OP          4 (>)
POP_JUMP_IF_FALSE   inner_continue
LOAD_FAST           cell
LIST_APPEND         3           # 3 levels up!
inner_continue:
JUMP_ABSOLUTE       inner_start
inner_end:
JUMP_ABSOLUTE       outer_start
outer_end:
RETURN_VALUE
```

The `LIST_APPEND 3` tells us we're three stack frames deep — the list, the outer loop, and the inner loop. Tracking this depth is essential for correct reconstruction.

### Python 3.12+: Inline Comprehensions (PEP 709)

Python 3.12 changed everything. Comprehensions are now *inlined* into the parent function:

```python
result = [x*2 for x in items]
```

Bytecode (3.12+):

```
GET_ITER
LOAD_FAST_AND_CLEAR     .0      # Save/clear iterator slot
SWAP                    2
BUILD_LIST              0
SWAP                    2
FOR_ITER                12 (to cleanup)
STORE_FAST              x
LOAD_FAST               x
LOAD_CONST              2
BINARY_OP               5 (*)
LIST_APPEND             2
JUMP_BACKWARD           7 (to FOR_ITER)
cleanup:
SWAP                    2
STORE_FAST              .0      # Restore iterator slot
RETURN_VALUE                    # Actually continues parent
```

**Why the change?** Performance. No function call overhead, no closure creation, better optimization opportunities.

**Why is it hard to decompile?** There's no clear boundary. The comprehension blends into surrounding code. We must recognize the *pattern*:

1. `GET_ITER` + `LOAD_FAST_AND_CLEAR` signals inline comprehension
2. `BUILD_LIST/SET/MAP 0` creates the accumulator
3. The loop with `LIST_APPEND/SET_ADD/MAP_ADD`
4. `SWAP` + `STORE_FAST` cleanup at the end

Current state: depyo.js reconstructs these as equivalent for-loops, which is semantically correct but loses the comprehension syntax. Full reconstruction is on the roadmap.

---

## Part 2: Exception Handling — Guaranteed Cleanup

### The Exception Table Evolution

Exception handling is where bytecode gets truly complex. Python must guarantee that `finally` blocks run, that exceptions propagate correctly, and that cleanup happens even on success.

**Pre-3.11 approach: Block stack**

```
SETUP_FINALLY       finally_label
SETUP_EXCEPT        except_label
... try body ...
POP_BLOCK                       # Exit except setup
POP_BLOCK                       # Exit finally setup
... else body (if no exception) ...
JUMP_FORWARD        end
except_label:
... exception handling ...
END_FINALLY
finally_label:
... finally body ...
END_FINALLY
end:
```

**Python 3.11+ approach: Exception table**

The block stack is gone. Instead, a separate exception table maps bytecode ranges to handlers:

```
Exception table:
  4 to 14 -> 16 [0]     # Offsets 4-14 go to handler at 16, stack depth 0
  16 to 24 -> 26 [1]    # Handler 16-24 goes to finally at 26, depth 1
```

The bytecode itself is cleaner:

```
... try body ...
PUSH_EXC_INFO                   # 3.11+: explicit exception push
... exception handling ...
POP_EXCEPT
... finally body ...
```

### Reconstructing try/except/else/finally

The full form is surprisingly intricate:

```python
try:
    risky_operation()
except ValueError as e:
    handle_value_error(e)
except (TypeError, KeyError):
    handle_type_or_key()
except:
    handle_any()
else:
    only_on_success()
finally:
    always_runs()
```

The decompilation algorithm:

```javascript
function decompileTryExcept(setupOffset, handlerOffset, finallyOffset) {
    // 1. Decompile try body (from setup to first handler)
    const tryBody = decompileBlock(setupOffset, handlerOffset);

    // 2. Parse exception handlers
    const handlers = [];
    let offset = handlerOffset;

    while (isExceptHandler(offset)) {
        const handler = parseExceptHandler(offset);
        handlers.push(handler);
        offset = handler.endOffset;
    }

    // 3. Check for else block (code between handlers and finally)
    let elseBody = null;
    if (offset < finallyOffset && !isJumpToFinally(offset)) {
        elseBody = decompileBlock(offset, finallyOffset);
    }

    // 4. Decompile finally body
    const finallyBody = finallyOffset ?
        decompileBlock(finallyOffset, findFinallyEnd(finallyOffset)) : null;

    // 5. Reconstruct
    return new ASTTryExcept(tryBody, handlers, elseBody, finallyBody);
}
```

### Exception Groups (Python 3.11+)

PEP 654 introduced `except*` for handling multiple exceptions simultaneously:

```python
try:
    async with trio.open_nursery() as nursery:
        nursery.start_soon(may_raise_value_error)
        nursery.start_soon(may_raise_type_error)
except* ValueError as eg:
    for exc in eg.exceptions:
        log_value_error(exc)
except* TypeError as eg:
    for exc in eg.exceptions:
        log_type_error(exc)
```

New bytecode operations:

```
PUSH_EXC_INFO
CHECK_EG_MATCH                  # Check exception group match
POP_JUMP_IF_NOT_NONE   handler
... handle matching exceptions ...
PREP_RERAISE_STAR              # Re-raise unhandled from group
```

The key insight: `except*` doesn't consume the entire exception. It *splits* the exception group, handles matching exceptions, and re-raises the rest. The decompiler must track this flow.

### The Cleanup Conundrum

Python 3.11+ generates synthetic cleanup code that shouldn't appear in source:

```
# Compiler-generated for except blocks:
LOAD_CONST          None
STORE_FAST          e           # Clear exception variable
DELETE_FAST         e
```

And exception table markers:

```
__exception__<EXCEPTION MATCH>StopIteration
```

A good decompiler must recognize and *suppress* these artifacts, showing only the meaningful code.

---

## Part 3: Async/Await — Cooperative Multitasking

### Coroutines: Functions That Pause

Async/await transforms normal functions into state machines:

```python
async def fetch_data(url):
    response = await http_get(url)
    data = await response.json()
    return data
```

This becomes a coroutine object that can:
- Start execution
- Pause at each `await`
- Resume when the awaited result is ready
- Return a final value or raise an exception

### The Bytecode of Async

**Async function definition:**

```
LOAD_CONST          <code object fetch_data>
LOAD_CONST          'fetch_data'
MAKE_FUNCTION       0
STORE_FAST          fetch_data
```

But the code object has `CO_COROUTINE` flag set. Inside:

```
# response = await http_get(url)
LOAD_GLOBAL         http_get
LOAD_FAST           url
CALL_FUNCTION       1
GET_AWAITABLE                   # Convert to awaitable
LOAD_CONST          None
YIELD_FROM                      # Pause here!
STORE_FAST          response

# data = await response.json()
LOAD_FAST           response
LOAD_METHOD         json
CALL_METHOD         0
GET_AWAITABLE
LOAD_CONST          None
YIELD_FROM
STORE_FAST          data

LOAD_FAST           data
RETURN_VALUE
```

### GET_AWAITABLE and YIELD_FROM

The `await` expression compiles to:

1. `GET_AWAITABLE` — Calls `__await__()` on the object to get an iterator
2. `LOAD_CONST None` — Initial send value
3. `YIELD_FROM` — Delegates to the awaitable's iterator

`YIELD_FROM` is the actual suspension point. It:
- Yields values from the sub-iterator to the caller
- Receives sent values and forwards them
- Handles exceptions in both directions
- Returns the final result when the sub-iterator is exhausted

### Async For and Async With

**Async iteration:**

```python
async for item in async_iterator:
    process(item)
```

Bytecode:

```
GET_AITER                       # async_iterator.__aiter__()
setup_loop:
GET_ANEXT                       # async_iterator.__anext__()
LOAD_CONST          None
YIELD_FROM                      # Await next item
STORE_FAST          item
... loop body ...
JUMP_ABSOLUTE       setup_loop
# StopAsyncIteration handling via exception table
```

**Async context manager:**

```python
async with resource() as r:
    use(r)
```

Bytecode:

```
# __aenter__
LOAD_FAST           resource
CALL_FUNCTION       0
BEFORE_ASYNC_WITH               # Setup
GET_AWAITABLE
LOAD_CONST          None
YIELD_FROM
STORE_FAST          r

... body ...

# __aexit__
LOAD_CONST          None        # Exception info (none = success)
LOAD_CONST          None
LOAD_CONST          None
CALL_FUNCTION       3           # __aexit__(None, None, None)
GET_AWAITABLE
LOAD_CONST          None
YIELD_FROM
POP_TOP
```

### Decompiling Async Code

The key is recognizing the patterns:

```javascript
function isAsyncFunction(codeObject) {
    return (codeObject.flags & CO_COROUTINE) !== 0;
}

function isAwaitExpression(offset) {
    const current = getInstruction(offset);
    const next = getInstruction(offset + 1);
    const after = getInstruction(offset + 2);

    return current.name === 'GET_AWAITABLE' &&
           next.name === 'LOAD_CONST' && next.arg === null &&
           after.name === 'YIELD_FROM';
}

function decompileAwait(offset) {
    // The awaited expression is already on the stack
    const awaitedExpr = stack.pop();

    // Skip GET_AWAITABLE, LOAD_CONST, YIELD_FROM
    skipInstructions(3);

    // Result is on stack
    return new ASTAwait(awaitedExpr);
}
```

### Python 3.11+ Changes

Python 3.11 introduced specialized async opcodes:

- `SEND` — Replaces `YIELD_FROM` for coroutines (more efficient)
- `END_SEND` — Cleanup after send
- `CLEANUP_THROW` — Handle thrown exceptions in generators

The decompiler must map these back to `await` expressions:

```javascript
case 'SEND':
    // In async context, SEND + END_SEND = await
    if (isInAsyncFunction() && peekNext().name === 'END_SEND') {
        return decompileAwait(offset);
    }
    // Otherwise it's generator.send()
    return decompileGeneratorSend(offset);
```

---

## Part 4: Putting It All Together

### A Complex Real-World Example

```python
async def process_urls(urls):
    results = {}
    async with aiohttp.ClientSession() as session:
        try:
            responses = [await fetch(session, url) for url in urls]
            for url, resp in zip(urls, responses):
                try:
                    data = await resp.json()
                    results[url] = data
                except ValueError:
                    results[url] = None
        except* aiohttp.ClientError as eg:
            for exc in eg.exceptions:
                log_error(exc)
        finally:
            await session.close()
    return results
```

This combines:
- Async function definition
- Async context manager (`async with`)
- List comprehension with `await`
- Nested try/except with exception groups
- Finally block with `await`
- Dict comprehension building

The bytecode runs to hundreds of instructions. Decompiling it correctly requires:

1. **Version detection** — Exception groups need 3.11+
2. **Flag checking** — Is it async? Is the comprehension inside async?
3. **Pattern matching** — Recognize inline comprehensions, await patterns, cleanup code
4. **State tracking** — Which try block are we in? What exceptions are caught?
5. **Synthesis** — Combine all pieces into readable source

### The Decompiler Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Code Object                             │
│  - bytecode instructions                                     │
│  - constants (including nested code objects)                 │
│  - variable names, free vars, cell vars                      │
│  - exception table (3.11+)                                   │
│  - line number table                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Pattern Recognition                        │
│  - Comprehension detection (pre-3.12 vs inline)             │
│  - Async pattern identification                              │
│  - Exception handler boundary detection                      │
│  - Control flow structure analysis                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Stack Simulation                           │
│  - Execute bytecode building AST nodes                       │
│  - Track block nesting (try, with, loops)                    │
│  - Handle jumps and branches                                 │
│  - Manage async suspension points                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AST Construction                          │
│  - Combine expressions into statements                       │
│  - Nest blocks correctly                                     │
│  - Attach line numbers                                       │
│  - Prune compiler-generated artifacts                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Source Generation                         │
│  - Render AST with proper indentation                        │
│  - Apply version-specific syntax                             │
│  - Format comprehensions elegantly                           │
│  - Preserve original line structure where possible           │
└─────────────────────────────────────────────────────────────┘
```

---

## Conclusion

Comprehensions, exceptions, and async/await represent Python at its most sophisticated. Each feature that makes Python expressive for programmers creates complexity for decompilers.

Yet this complexity is not arbitrary. It reflects real constraints:
- **Comprehensions** must scope variables correctly and allow nesting
- **Exception handling** must guarantee cleanup regardless of how code exits
- **Async** must track suspension points and maintain coroutine state

Understanding these mechanisms deepens our appreciation for Python's design. The bytecode reveals the engineering behind the elegance.

### Current Status of depyo.js

| Feature | Support Level | Notes |
|---------|---------------|-------|
| List/Set/Dict Comprehensions | Full (pre-3.12) | Inline 3.12+ → for-loops |
| Generator Expressions | Full | All versions |
| Nested Comprehensions | Full | Correct depth tracking |
| try/except/else/finally | Full | All versions |
| Exception Groups (except*) | Full | 3.11+ |
| async/await | Full | 3.5+ |
| async for/with | Full | Correct cleanup handling |

### Try It Yourself

```bash
npm install -g depyo

# Decompile with disassembly to see both
depyo --asm your_async_code.pyc

# Process entire project
depyo --basedir recovered/ project/**/*.pyc
```

The source code is at [github.com/skuznetsov/depyo.js](https://github.com/skuznetsov/depyo.js).

---

## What's Next

In Part 3, we'll explore:
- **Decorators and descriptors** — Metaprogramming in bytecode
- **Class definitions** — `__build_class__` and metaclasses
- **Pattern matching deep dive** — The full complexity of `match`/`case`

---

*Sergey Kuznetsov has been reverse-engineering Python bytecode since 2010. depyo.js is the result of that journey — a decompiler that handles Python 1.0 through 3.14.*
