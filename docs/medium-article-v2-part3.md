# Python Bytecode Decompilation: Classes, Decorators, and Pattern Matching

*Part 3: Metaprogramming and the Match Revolution*

---

## Introduction

In [Part 1](link-to-part-1), we covered bytecode fundamentals and control flow. [Part 2](link-to-part-2) explored comprehensions, exceptions, and async. Now we tackle Python's most powerful abstractions:

1. **Decorators** — Functions that transform functions (and classes)
2. **Class definitions** — The `__build_class__` machinery
3. **Pattern matching** — Python 3.10's game-changing addition

These features share a common theme: *metaprogramming*. Code that generates, modifies, or inspects other code. In bytecode, this means layers of indirection that a decompiler must carefully unravel.

---

## Part 1: Decorators — Wrapping and Transforming

### The Decorator Illusion

Decorators look like magic:

```python
@logged
@cached
def expensive_calculation(x):
    return x ** x
```

But they're just syntactic sugar for function composition:

```python
def expensive_calculation(x):
    return x ** x
expensive_calculation = cached(logged(expensive_calculation))
```

### Decorator Bytecode

The decorated function compiles to:

```
LOAD_GLOBAL         logged
LOAD_GLOBAL         cached
LOAD_CONST          <code object expensive_calculation>
LOAD_CONST          'expensive_calculation'
MAKE_FUNCTION       0
CALL_FUNCTION       1           # cached(func)
CALL_FUNCTION       1           # logged(cached(func))
STORE_FAST          expensive_calculation
```

Notice the order: decorators are loaded *bottom-up* (cached, then logged), but applied *top-down* (logged wraps the result of cached).

### Decorators with Arguments

```python
@retry(attempts=3, delay=1.0)
def flaky_operation():
    pass
```

This adds another layer:

```
LOAD_GLOBAL         retry
LOAD_CONST          3
LOAD_CONST          1.0
LOAD_CONST          ('attempts', 'delay')
CALL_FUNCTION_KW    2           # retry(attempts=3, delay=1.0)
LOAD_CONST          <code object flaky_operation>
LOAD_CONST          'flaky_operation'
MAKE_FUNCTION       0
CALL_FUNCTION       1           # decorator_result(func)
STORE_FAST          flaky_operation
```

The `@retry(...)` is a *decorator factory* — it's called first, returning the actual decorator.

### Decompiling Decorators

The challenge: bytecode doesn't mark "this is a decorator." We must recognize the pattern:

```javascript
function detectDecorators(functionDef) {
    const decorators = [];
    let offset = functionDef.startOffset;

    // Walk backward from MAKE_FUNCTION
    while (offset > 0) {
        const instr = getInstruction(offset - 1);

        if (instr.name === 'LOAD_GLOBAL' || instr.name === 'LOAD_NAME') {
            // Simple decorator: @name
            decorators.unshift(new ASTName(instr.argument));
            offset--;
        } else if (instr.name === 'CALL_FUNCTION' ||
                   instr.name === 'CALL_FUNCTION_KW') {
            // Decorator with arguments: @name(args)
            const call = decompileCallBackward(offset - 1);
            decorators.unshift(call.node);
            offset = call.startOffset;
        } else {
            break;  // No more decorators
        }
    }

    return decorators;
}
```

After `MAKE_FUNCTION`, we count `CALL_FUNCTION` instructions — each represents one decorator application. The count must match our detected decorators.

### Class Decorators

```python
@dataclass
@total_ordering
class Point:
    x: int
    y: int
```

Same pattern, but with `LOAD_BUILD_CLASS` instead of `MAKE_FUNCTION`:

```
LOAD_GLOBAL         dataclass
LOAD_GLOBAL         total_ordering
LOAD_BUILD_CLASS
LOAD_CONST          <code object Point>
LOAD_CONST          'Point'
MAKE_FUNCTION       0
LOAD_CONST          'Point'
LOAD_GLOBAL         object
CALL_FUNCTION       3           # __build_class__(func, 'Point', object)
CALL_FUNCTION       1           # total_ordering(class)
CALL_FUNCTION       1           # dataclass(total_ordering(class))
STORE_FAST          Point
```

---

## Part 2: Class Definitions — The Build Class Protocol

### How Python Builds Classes

Every class definition invokes `__build_class__`:

```python
class MyClass(BaseClass, metaclass=Meta):
    class_var = 42

    def method(self):
        pass
```

This conceptually becomes:

```python
def __class_body__():
    __qualname__ = 'MyClass'
    class_var = 42
    def method(self):
        pass
    return locals()

MyClass = __build_class__(__class_body__, 'MyClass', BaseClass, metaclass=Meta)
```

### Class Body Code Object

The class body is a separate code object with special properties:

```
# Inside class body code object
LOAD_NAME           __name__
STORE_NAME          __module__
LOAD_CONST          'MyClass'
STORE_NAME          __qualname__

LOAD_CONST          42
STORE_NAME          class_var

LOAD_CONST          <code object method>
LOAD_CONST          'MyClass.method'
MAKE_FUNCTION       0
STORE_NAME          method

LOAD_CONST          None
RETURN_VALUE
```

Notice: the class body uses `STORE_NAME` (not `STORE_FAST`) because class-level assignments go into the class namespace, not local variables.

### Detecting Class Definitions

```javascript
function isClassDefinition(offset) {
    const instr = getInstruction(offset);

    // Python 3.x
    if (instr.name === 'LOAD_BUILD_CLASS') {
        return true;
    }

    // Python 2.x
    if (instr.name === 'BUILD_CLASS') {
        return true;
    }

    return false;
}

function decompileClass(offset) {
    // Skip LOAD_BUILD_CLASS
    offset++;

    // Get class body code object
    const bodyCode = getConstant(offset);  // LOAD_CONST <code>
    offset++;

    // Get class name
    const className = getConstant(offset);  // LOAD_CONST 'ClassName'
    offset++;

    // MAKE_FUNCTION for the body
    offset++;  // Skip MAKE_FUNCTION

    // Parse bases and keywords
    const bases = [];
    const keywords = {};

    while (!isCallToBuilldClass(offset)) {
        if (getInstruction(offset).name === 'LOAD_CONST' &&
            getInstruction(offset + 1).name === 'CALL_FUNCTION_KW') {
            // Keyword arguments (metaclass=, etc.)
            const kwNames = getConstant(offset);
            // ... parse keywords
        } else {
            // Base class
            bases.push(decompileExpression(offset));
        }
        offset++;
    }

    // Decompile class body
    const body = decompileCodeObject(bodyCode);

    return new ASTClass(className, bases, keywords, body, decorators);
}
```

### Python 2 vs Python 3 Classes

**Python 2:**
```
LOAD_CONST          'ClassName'
LOAD_NAME           BaseClass
BUILD_TUPLE         1           # Bases tuple
LOAD_CONST          <code object ClassName>
MAKE_FUNCTION       0
CALL_FUNCTION       0           # Execute body
BUILD_CLASS                     # Build the class
STORE_NAME          ClassName
```

**Python 3:**
```
LOAD_BUILD_CLASS
LOAD_CONST          <code object ClassName>
LOAD_CONST          'ClassName'
MAKE_FUNCTION       0
LOAD_CONST          'ClassName'
LOAD_NAME           BaseClass
CALL_FUNCTION       3           # __build_class__(body, name, base)
STORE_NAME          ClassName
```

The decompiler must handle both patterns.

### Metaclasses and __prepare__

When a metaclass defines `__prepare__`, the class namespace can be non-dict:

```python
class OrderedClass(metaclass=OrderedMeta):
    first = 1
    second = 2
    # __prepare__ returns OrderedDict, so order is preserved
```

Bytecode for keyword arguments:

```
LOAD_BUILD_CLASS
LOAD_CONST          <code object OrderedClass>
LOAD_CONST          'OrderedClass'
MAKE_FUNCTION       0
LOAD_CONST          'OrderedClass'
LOAD_GLOBAL         OrderedMeta
LOAD_CONST          ('metaclass',)
CALL_FUNCTION_KW    3           # __build_class__(..., metaclass=OrderedMeta)
STORE_NAME          OrderedClass
```

### __slots__, __init_subclass__, and Friends

Class body may contain special declarations:

```python
class Optimized:
    __slots__ = ('x', 'y', 'z')

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        register(cls)
```

These are just normal assignments in bytecode — the magic happens at class creation time. The decompiler treats them as regular statements.

---

## Part 3: Pattern Matching — Python's Biggest Bytecode Change

### The Match Statement Revolution

Python 3.10 introduced structural pattern matching (PEP 634):

```python
match command:
    case ["quit"]:
        sys.exit(0)
    case ["load", filename]:
        load_file(filename)
    case ["save", filename] if filename.endswith('.txt'):
        save_as_text(filename)
    case {"action": action, "target": target}:
        perform(action, target)
    case Point(x=0, y=y):
        print(f"On Y axis at {y}")
    case _:
        print("Unknown command")
```

This single feature introduced **10+ new opcodes** — more than any Python release in history.

### New Pattern Matching Opcodes

| Opcode | Purpose |
|--------|---------|
| `MATCH_SEQUENCE` | Check if subject is a sequence |
| `MATCH_MAPPING` | Check if subject is a mapping |
| `MATCH_CLASS` | Check if subject is instance of class |
| `MATCH_KEYS` | Extract values for specific keys |
| `GET_LEN` | Get length for sequence patterns |
| `MATCH_CLASS` | Positional and keyword attribute matching |
| `COPY` | Duplicate stack top (for multiple tests) |
| `BINARY_OP` | Used with special match comparisons |

### Sequence Pattern Bytecode

```python
match value:
    case [first, *rest, last]:
        process(first, rest, last)
```

Compiles to:

```
LOAD_FAST           value
COPY                1               # Duplicate for pattern check

# Check it's a sequence
MATCH_SEQUENCE
POP_JUMP_IF_FALSE   next_pattern

# Check length >= 2 (first and last required)
GET_LEN
LOAD_CONST          2
COMPARE_OP          5 (>=)
POP_JUMP_IF_FALSE   next_pattern

# Unpack with star
UNPACK_EX           1 (1 before, 1 after)
STORE_FAST          first
STORE_FAST          rest
STORE_FAST          last

# Pattern matched - execute body
... case body ...
JUMP_FORWARD        end_match

next_pattern:
POP_TOP                             # Discard copied value
... next case ...

end_match:
```

### Mapping Pattern Bytecode

```python
match config:
    case {"host": host, "port": port, **rest}:
        connect(host, port, rest)
```

Compiles to:

```
LOAD_FAST           config
COPY                1

# Check it's a mapping
MATCH_MAPPING
POP_JUMP_IF_FALSE   next_pattern

# Check required keys exist and extract values
LOAD_CONST          ('host', 'port')
MATCH_KEYS
POP_JUMP_IF_FALSE   next_pattern

# Keys matched - unpack values
COPY                1               # For **rest capture
UNPACK_SEQUENCE     2
STORE_FAST          host
STORE_FAST          port

# Capture remaining items
LOAD_CONST          ('host', 'port')
DICT_UPDATE         1               # Remove matched keys
STORE_FAST          rest

... case body ...
```

### Class Pattern Bytecode

```python
match shape:
    case Circle(radius=r) if r > 0:
        area = 3.14159 * r * r
```

Compiles to:

```
LOAD_FAST           shape
COPY                1

# Check it's a Circle instance
LOAD_GLOBAL         Circle
MATCH_CLASS         1               # 1 keyword pattern
POP_JUMP_IF_NONE    next_pattern

# Extract matched attributes
UNPACK_SEQUENCE     1
STORE_FAST          r

# Guard condition
LOAD_FAST           r
LOAD_CONST          0
COMPARE_OP          4 (>)
POP_JUMP_IF_FALSE   next_pattern

... case body ...
```

### The OR Pattern Complication

```python
match status:
    case 200 | 201 | 204:
        print("Success")
```

This creates branching within a single case:

```
LOAD_FAST           status
COPY                1

# First alternative: 200
LOAD_CONST          200
COMPARE_OP          2 (==)
POP_JUMP_IF_TRUE    pattern_matched

# Second alternative: 201
COPY                1
LOAD_CONST          201
COMPARE_OP          2 (==)
POP_JUMP_IF_TRUE    pattern_matched

# Third alternative: 204
COPY                1
LOAD_CONST          204
COMPARE_OP          2 (==)
POP_JUMP_IF_FALSE   next_pattern

pattern_matched:
POP_TOP                             # Discard subject copy
... case body ...
```

### Decompiling Pattern Matching

The challenge is reconstructing the *pattern* from bytecode that tests properties:

```javascript
function decompileMatchStatement(offset) {
    // LOAD subject
    const subject = stack.pop();

    const cases = [];

    while (isMatchCaseBytecode(offset)) {
        const caseResult = decompileMatchCase(offset);
        cases.push(caseResult.case);
        offset = caseResult.nextOffset;
    }

    return new ASTMatch(subject, cases);
}

function decompileMatchCase(offset) {
    // Detect pattern type from first instruction after COPY
    const patternStart = offset + 1;  // Skip COPY
    const patternInstr = getInstruction(patternStart);

    let pattern;

    switch (patternInstr.name) {
        case 'MATCH_SEQUENCE':
            pattern = decompileSequencePattern(patternStart);
            break;
        case 'MATCH_MAPPING':
            pattern = decompileMappingPattern(patternStart);
            break;
        case 'LOAD_GLOBAL':
        case 'LOAD_NAME':
            // Could be class pattern or literal
            if (peekAhead(patternStart, 'MATCH_CLASS')) {
                pattern = decompileClassPattern(patternStart);
            } else {
                pattern = decompileLiteralPattern(patternStart);
            }
            break;
        case 'LOAD_CONST':
            pattern = decompileLiteralPattern(patternStart);
            break;
        // ... more pattern types
    }

    // Check for guard (if condition after pattern)
    const guard = detectGuard(pattern.endOffset);

    // Find case body
    const body = decompileCaseBody(guard?.endOffset || pattern.endOffset);

    return {
        case: new ASTMatchCase(pattern.node, guard?.node, body),
        nextOffset: body.endOffset
    };
}
```

### The Version Guard Trap

Here's a critical insight that cost us debugging time:

**Chained comparisons in Python < 3.10** produce bytecode that *looks like* pattern matching setup:

```python
# Python 3.9 code
if 0 <= x <= 10:
    in_range()
```

Bytecode:
```
LOAD_CONST          0
LOAD_FAST           x
DUP_TOP                             # Looks like COPY!
ROT_THREE
COMPARE_OP          5 (<=)
POP_JUMP_IF_FALSE   cleanup
LOAD_CONST          10
COMPARE_OP          5 (<=)          # Looks like pattern comparison!
POP_JUMP_IF_FALSE   else_branch
... if body ...
```

A decompiler must **check the Python version** before interpreting `DUP_TOP` + comparisons as pattern matching:

```javascript
function lookAheadForMatchPattern() {
    // Match patterns only exist in Python 3.10+
    if (this.versionCompare(3, 10) < 0) {
        return false;  // Cannot be a match pattern!
    }

    // ... pattern detection logic
}
```

Without this guard, Python 2.7 code with chained comparisons would incorrectly decompile as `match` statements!

---

## Part 4: Descriptors and Properties

### The Descriptor Protocol

Descriptors power Python's attribute access:

```python
class Celsius:
    def __get__(self, obj, type=None):
        return obj._celsius

    def __set__(self, obj, value):
        obj._celsius = value

class Temperature:
    celsius = Celsius()
```

In bytecode, this is just a class with methods — no special opcodes. The magic is in the *runtime* protocol.

### Properties as Descriptors

```python
class Circle:
    def __init__(self, radius):
        self._radius = radius

    @property
    def area(self):
        return 3.14159 * self._radius ** 2

    @area.setter
    def area(self, value):
        self._radius = (value / 3.14159) ** 0.5
```

Bytecode for property definition:

```
# @property def area(self):
LOAD_GLOBAL         property
LOAD_CONST          <code object area>
LOAD_CONST          'Circle.area'
MAKE_FUNCTION       0
CALL_FUNCTION       1               # property(area_getter)
STORE_NAME          area

# @area.setter def area(self, value):
LOAD_NAME           area
LOAD_ATTR           setter
LOAD_CONST          <code object area>
LOAD_CONST          'Circle.area'
MAKE_FUNCTION       0
CALL_FUNCTION       1               # area.setter(area_setter)
STORE_NAME          area
```

### Decompiling Properties

We recognize the pattern and reconstruct decorator syntax:

```javascript
function isPropertyDefinition(offset) {
    const instr = getInstruction(offset);

    // Direct property creation
    if (instr.name === 'LOAD_GLOBAL' || instr.name === 'LOAD_NAME') {
        if (instr.argument === 'property') {
            return 'property_getter';
        }
    }

    // Property setter/deleter
    if (instr.name === 'LOAD_NAME' || instr.name === 'LOAD_FAST') {
        const next = getInstruction(offset + 1);
        if (next.name === 'LOAD_ATTR' &&
            ['setter', 'deleter'].includes(next.argument)) {
            return `property_${next.argument}`;
        }
    }

    return null;
}
```

### classmethod and staticmethod

```python
class MyClass:
    @classmethod
    def from_string(cls, s):
        return cls(parse(s))

    @staticmethod
    def utility(x):
        return x * 2
```

Bytecode:

```
# @classmethod
LOAD_NAME           classmethod
LOAD_CONST          <code object from_string>
LOAD_CONST          'MyClass.from_string'
MAKE_FUNCTION       0
CALL_FUNCTION       1
STORE_NAME          from_string

# @staticmethod
LOAD_NAME           staticmethod
LOAD_CONST          <code object utility>
LOAD_CONST          'MyClass.utility'
MAKE_FUNCTION       0
CALL_FUNCTION       1
STORE_NAME          utility
```

Same decorator pattern — just different decorator names.

---

## Part 5: The Full Picture

### A Complex Class Example

```python
@dataclass(frozen=True)
class Vector:
    """An immutable 2D vector."""

    __slots__ = ('_x', '_y')

    x: float
    y: float

    def __post_init__(self):
        object.__setattr__(self, '_x', float(self.x))
        object.__setattr__(self, '_y', float(self.y))

    @property
    def magnitude(self):
        return (self.x ** 2 + self.y ** 2) ** 0.5

    @classmethod
    def from_polar(cls, r, theta):
        return cls(r * cos(theta), r * sin(theta))

    def __add__(self, other):
        match other:
            case Vector(x=ox, y=oy):
                return Vector(self.x + ox, self.y + oy)
            case (ox, oy):
                return Vector(self.x + ox, self.y + oy)
            case _:
                return NotImplemented
```

This combines:
- Class decorator with arguments (`@dataclass(frozen=True)`)
- Docstring
- `__slots__` declaration
- Type annotations (become `__annotations__`)
- Property decorator
- classmethod decorator
- Pattern matching inside a method

Decompiling correctly requires handling all these patterns and their interactions.

### Version-Specific Rendering

The decompiler must render code appropriately for its source version:

```javascript
class SourceRenderer {
    constructor(pythonVersion) {
        this.version = pythonVersion;
    }

    renderPrint(args) {
        if (this.version[0] === 2) {
            // Python 2: print statement
            if (args.file) {
                return `print >> ${args.file}, ${args.values.join(', ')}`;
            }
            return `print ${args.values.join(', ')}`;
        } else {
            // Python 3: print function
            return `print(${args.values.join(', ')})`;
        }
    }

    renderAnnotation(name, annotation, value) {
        if (this.version[0] === 2) {
            // Python 2: no annotations
            return value ? `${name} = ${value}` : `${name} = None`;
        } else if (this.versionCompare(3, 6) < 0) {
            // Python 3.0-3.5: annotation in comment
            return `${name} = ${value}  # type: ${annotation}`;
        } else {
            // Python 3.6+: proper annotation
            return value ?
                `${name}: ${annotation} = ${value}` :
                `${name}: ${annotation}`;
        }
    }

    renderMatchStatement(match) {
        if (this.versionCompare(3, 10) < 0) {
            // Cannot use match in older Python - convert to if/elif
            return this.matchToIfElse(match);
        }
        return this.renderMatch(match);
    }
}
```

---

## Conclusion: The Art of Decompilation

Decompiling Python is both science and art:

- **Science:** Understanding bytecode semantics, opcode behavior, version differences
- **Art:** Recognizing patterns, handling ambiguity, producing readable output

Each Python version adds new challenges. Pattern matching was the biggest single change. Inline comprehensions broke assumptions about code object boundaries. The JIT in 3.13+ adds specialized opcodes.

Yet the core principle remains: **simulate execution, build structure, render source**.

### The depyo.js Journey

| Year | Milestone |
|------|-----------|
| 2010 | First version in C# (Python 2.x) |
| 2022 | Rewrite in JavaScript |
| 2023 | Python 3.x support |
| 2024 | Pattern matching, exception groups |
| 2025 | Python 3.14 support, inline comprehensions (partial) |

14 years of evolution, tracking Python's own evolution.

### Get Involved

The project is open source: [github.com/skuznetsov/depyo.js](https://github.com/skuznetsov/depyo.js)

**Quick start:**
```bash
npm install -g depyo
depyo --asm mysterious.pyc
```

**For contributors:**
- Inline comprehension reconstruction (3.12+)
- Enhanced pattern matching edge cases
- Performance optimization for large codebases

---

## Appendix: Quick Reference

### Decorator Detection Pattern
```
LOAD_* decorator_name
[CALL_FUNCTION* if decorator has args]
... possibly more decorators ...
LOAD_CONST <code object>
LOAD_CONST 'func_name'
MAKE_FUNCTION
CALL_FUNCTION × (number of decorators)
STORE_* func_name
```

### Class Definition Pattern (Python 3)
```
LOAD_BUILD_CLASS
LOAD_CONST <code object>
LOAD_CONST 'ClassName'
MAKE_FUNCTION
LOAD_CONST 'ClassName'
[LOAD_* base_class]*
[LOAD_CONST (keyword_names) if keywords]
CALL_FUNCTION[_KW] n
[CALL_FUNCTION × decorators if decorated]
STORE_* ClassName
```

### Match Statement Pattern (Python 3.10+)
```
LOAD_* subject
[COPY 1]
MATCH_SEQUENCE | MATCH_MAPPING | LOAD_* + MATCH_CLASS | LOAD_CONST
... pattern matching logic ...
POP_JUMP_IF_FALSE next_case
... case body ...
JUMP_FORWARD end_match
```

---

*This concludes the three-part series on Python bytecode decompilation. From simple arithmetic to pattern matching, from Python 1.0 to 3.14 — the bytecode tells the story of Python's evolution.*
