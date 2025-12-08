#!/usr/bin/env python3
"""
Generate test files for modern Python features (3.8-3.14)
Compiles them with appropriate Python versions
"""

import os
import sys
import subprocess
import py_compile
from pathlib import Path

# Test cases for modern Python features
TEST_CASES = {
    # Python 3.8: Walrus operator
    "py38_walrus_basic": """
# Walrus operator in if statement
if (n := 10) > 5:
    print(f"n is {n}")

# Walrus operator in while loop
data = [1, 2, 3, 4, 5]
while (item := data.pop() if data else None) is not None:
    print(item)

# Walrus operator in list comprehension
values = [1, 2, 3, 4, 5]
filtered = [y for x in values if (y := x * 2) > 4]
""",

    "py38_positional_only": """
# Positional-only parameters
def greet(name, /, greeting="Hello"):
    return f"{greeting}, {name}!"

result = greet("Alice")
result2 = greet("Bob", greeting="Hi")
""",

    "py38_fstring_equals": """
# f-string debugging with =
x = 42
y = "hello"
debug_str = f"{x=} {y=}"
print(debug_str)
""",

    # Python 3.9: Dict merge, union types
    "py39_dict_merge": """
# Dict merge operators
dict1 = {"a": 1, "b": 2}
dict2 = {"c": 3, "d": 4}
merged = dict1 | dict2

dict3 = {"a": 10}
dict1 |= dict3  # In-place merge
""",

    "py39_type_hints": """
# Generic type hints without importing typing
def process_list(items: list[int]) -> list[str]:
    return [str(x) for x in items]

def get_dict() -> dict[str, int]:
    return {"one": 1, "two": 2}

# Tuple and set generics
coords: tuple[float, float] = (1.0, 2.0)
unique: set[str] = {"a", "b", "c"}
""",

    "py39_str_methods": """
# New string methods
text = "prefix_content_suffix"
without_prefix = text.removeprefix("prefix_")
without_suffix = text.removesuffix("_suffix")
""",

    # Python 3.10: Pattern matching
    "py310_match_basic": """
# Basic match/case
def describe_number(n):
    match n:
        case 0:
            return "zero"
        case 1:
            return "one"
        case _:
            return "many"

result = describe_number(1)
""",

    "py310_match_patterns": """
# Pattern matching with structure
def analyze_point(point):
    match point:
        case (0, 0):
            return "origin"
        case (0, y):
            return f"on y-axis at {y}"
        case (x, 0):
            return f"on x-axis at {x}"
        case (x, y):
            return f"point at ({x}, {y})"

result = analyze_point((3, 4))
""",

    "py310_match_classes": """
# Pattern matching with classes
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

def where_is(point):
    match point:
        case Point(x=0, y=0):
            return "origin"
        case Point(x=0, y=y):
            return f"on y-axis at y={y}"
        case Point(x=x, y=0):
            return f"on x-axis at x={x}"
        case Point(x=x, y=y):
            return f"at ({x}, {y})"
        case _:
            return "unknown"

p = Point(1, 2)
result = where_is(p)
""",

    "py310_union_types": """
# Union types with |
def process(value: int | str) -> str:
    return str(value)

def maybe_int(x: int | None) -> int:
    return x if x is not None else 0
""",

    "py310_match_guards": """
# Pattern matching with guards
def categorize(x):
    match x:
        case int(n) if n < 0:
            return "negative"
        case int(n) if n == 0:
            return "zero"
        case int(n) if n > 0:
            return "positive"
        case _:
            return "not an int"
""",

    # Python 3.11: Exception groups
    "py311_exception_groups": """
# Exception groups
def raise_multiple():
    raise ExceptionGroup("multiple errors", [
        ValueError("bad value"),
        TypeError("bad type")
    ])

try:
    raise_multiple()
except* ValueError as e:
    print(f"Caught ValueError group: {e}")
except* TypeError as e:
    print(f"Caught TypeError group: {e}")
""",

    "py311_exception_notes": """
# Exception notes (Python 3.11+)
try:
    raise ValueError("something went wrong")
except ValueError as e:
    e.add_note("Additional context")
    e.add_note("Even more info")
    raise
""",

    # Python 3.13+: Exception group reraises / PREP_RERAISE_STAR
    "py313_exception_prep_reraise": """
def split_group():
    try:
        raise ExceptionGroup("eg", [ValueError("a"), TypeError("b")])
    except* ValueError as e:
        note = str(e)
    return note
""",

    # Python 3.13+: WITH_EXCEPT_START_A/cleanup with exception groups
    "py313_with_prep_reraise": """
def with_and_except(path):
    result = "done"
    try:
        with open(path) as f:
            f.write("x")
            raise ExceptionGroup("eg", [OSError("io"), ValueError("val")])
    except* OSError as err:
        result = str(err)
    return result
""",

    # Python 3.14: same coverage, explicit 3.14 naming for matrix patterns
    "py314_exception_prep_reraise": """
def split_group():
    try:
        raise ExceptionGroup("eg", [ValueError("a"), TypeError("b")])
    except* ValueError as e:
        note = str(e)
    return note
""",

    "py314_with_prep_reraise": """
def with_and_except(path):
    result = "done"
    try:
        with open(path) as f:
            f.write("x")
            raise ExceptionGroup("eg", [OSError("io"), ValueError("val")])
    except* OSError as err:
        result = str(err)
    return result
""",

    # Python 3.12: Type parameters
    "py312_type_params": """
# Type parameter syntax
def first[T](items: list[T]) -> T:
    return items[0]

class Stack[T]:
    def __init__(self):
        self.items: list[T] = []

    def push(self, item: T) -> None:
        self.items.append(item)

    def pop(self) -> T:
        return self.items.pop()

# Usage
numbers = first([1, 2, 3])
stack = Stack[int]()
stack.push(42)
""",

    "py312_type_alias": """
# type statement
type Point = tuple[float, float]
type Matrix = list[list[float]]

def distance(p1: Point, p2: Point) -> float:
    return ((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)**0.5

point1: Point = (0.0, 0.0)
point2: Point = (3.0, 4.0)
d = distance(point1, point2)
""",

    "py312_override": """
# @override decorator
from typing import override

class Base:
    def method(self) -> str:
        return "base"

class Derived(Base):
    @override
    def method(self) -> str:
        return "derived"
""",

    # Python 3.13: Free-threading support
    "py313_basic": """
# Test basic constructs for Python 3.13
# (No specific new syntax, but bytecode changes)

def compute(x: int, y: int) -> int:
    result = x + y
    return result

numbers = [1, 2, 3, 4, 5]
squared = [x**2 for x in numbers]

# Dict comprehension
squares_dict = {x: x**2 for x in range(5)}
""",

    # Async features (3.6+)
    "py36_async_comprehensions": """
# Async comprehensions
async def async_generator():
    for i in range(5):
        yield i

async def use_async_comp():
    # Async list comprehension
    result = [i async for i in async_generator()]

    # Async dict comprehension
    squared = {i: i**2 async for i in async_generator()}

    return result
""",

    "py36_async_generator": """
# Async generators
async def async_range(n):
    for i in range(n):
        yield i

async def consume():
    async for value in async_range(5):
        print(value)
""",

    # f-strings (3.6+)
    "py36_fstrings": """
# f-strings
name = "Alice"
age = 30
greeting = f"Hello, {name}!"
info = f"{name} is {age} years old"

# f-strings with expressions
numbers = [1, 2, 3]
summary = f"Sum: {sum(numbers)}, Max: {max(numbers)}"

# f-strings with format specs
pi = 3.14159
formatted = f"Pi is approximately {pi:.2f}"
""",

    "py36_fstrings_nested": """
# Nested f-strings
name = "Bob"
value = 42
nested = f"Name: {name}, Value: {f'0x{value:x}'}"

# f-strings in comprehensions
names = ["Alice", "Bob", "Charlie"]
greetings = [f"Hello, {name}!" for name in names]
""",

    # Numeric literals (3.6+)
    "py36_numeric_literals": """
# Underscores in numeric literals
million = 1_000_000
binary = 0b_1010_1010
hex_value = 0x_FF_AA_00
float_val = 1_234.567_89
""",
}

def generate_test_file(name: str, code: str, output_dir: Path) -> Path:
    """Generate a single test file"""
    filepath = output_dir / f"{name}.py"
    filepath.write_text(code)
    print(f"Generated: {filepath}")
    return filepath

def compile_test_file(source_path: Path, python_version: str) -> bool:
    """Compile a test file with specific Python version"""
    # Try to find the Python executable
    python_exe = f"python{python_version}"

    try:
        # Test if Python version is available
        result = subprocess.run(
            [python_exe, "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode != 0:
            print(f"  ⚠️  Python {python_version} not available")
            return False

        # Compile the file
        output_dir = source_path.parent.parent / f"bytecode_{python_version}"
        output_dir.mkdir(exist_ok=True)

        pyc_path = output_dir / source_path.with_suffix(".pyc").name

        subprocess.run(
            [python_exe, "-m", "py_compile", str(source_path)],
            check=True,
            capture_output=True,
            timeout=10
        )

        # Find the generated .pyc file (Python 3 puts it in __pycache__)
        pycache = source_path.parent / "__pycache__"
        if pycache.exists():
            for pyc in pycache.glob("*.pyc"):
                pyc.rename(pyc_path)
                pycache.rmdir() if not list(pycache.iterdir()) else None
                print(f"  ✓ Compiled: {pyc_path}")
                return True

        print(f"  ⚠️  Could not find .pyc file")
        return False

    except subprocess.TimeoutExpired:
        print(f"  ⚠️  Timeout compiling with Python {python_version}")
        return False
    except subprocess.CalledProcessError as e:
        print(f"  ⚠️  Compilation error: {e}")
        return False
    except Exception as e:
        print(f"  ⚠️  Error: {e}")
        return False

def main():
    # Create output directory
    test_dir = Path(__file__).parent / "modern_features"
    test_dir.mkdir(exist_ok=True)

    print("=" * 70)
    print("Generating Modern Python Feature Tests")
    print("=" * 70)

    # Generate all test files
    generated = []
    for name, code in TEST_CASES.items():
        filepath = generate_test_file(name, code, test_dir)
        generated.append((name, filepath))

    print(f"\n✓ Generated {len(generated)} test files\n")

    # Compile with available Python versions
    print("=" * 70)
    print("Compiling Test Files")
    print("=" * 70)

    versions_to_test = ["3.8", "3.9", "3.10", "3.11", "3.12", "3.13", "3.14"]

    stats = {ver: {"success": 0, "failed": 0} for ver in versions_to_test}

    for name, filepath in generated:
        print(f"\n{name}:")

        # Determine minimum Python version from filename
        if "py314" in name:
            min_ver = "3.14"
        elif "py313" in name:
            min_ver = "3.13"
        elif "py38" in name:
            min_ver = "3.8"
        elif "py39" in name:
            min_ver = "3.9"
        elif "py310" in name:
            min_ver = "3.10"
        elif "py311" in name:
            min_ver = "3.11"
        elif "py312" in name:
            min_ver = "3.12"
        else:
            min_ver = "3.6"

        for version in versions_to_test:
            if float(version) >= float(min_ver):
                if compile_test_file(filepath, version):
                    stats[version]["success"] += 1
                else:
                    stats[version]["failed"] += 1

    # Print statistics
    print("\n" + "=" * 70)
    print("Compilation Statistics")
    print("=" * 70)
    for version in versions_to_test:
        success = stats[version]["success"]
        failed = stats[version]["failed"]
        total = success + failed
        if total > 0:
            print(f"Python {version}: {success}/{total} compiled successfully")

    print(f"\n✓ Test generation complete!")
    print(f"  Source files: {test_dir}")
    print(f"  Bytecode files: test/bytecode_X.Y/")

if __name__ == "__main__":
    main()
