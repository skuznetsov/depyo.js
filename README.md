# depyo — Python bytecode decompiler in Node.js

Depyo converts Python `.pyc` files (or archives of them) back to readable Python source — right from Node.js, without a Python runtime. Coverage spans **Python 1.0 through 3.15** plus PyPy, with first-class support for modern features: match/case, walrus, f-strings, exception groups, async/await, type parameters, PEP 696 TypeVar defaults, and t-strings (PEP 750).

```bash
npx depyo my_script.pyc
# → writes my_script.py next to the input
```

## What it's good for

- **Reverse engineering stripped Python.** You have a `.pyc` (maybe extracted from a PyInstaller binary, an Android APK's Kivy bundle, or an old archive) and no source. Depyo reconstructs the source — even for Python versions the original `uncompyle6`/`decompyle3` no longer follow.
- **Malware / threat analysis.** Quickly triage suspicious Python payloads without setting up a matching Python interpreter. Add `--asm` for a bytecode listing alongside the source.
- **Forensics on old codebases.** Resurrect Python 2.x (even 1.x) modules when the source is long gone.
- **CI-side audits.** Depyo is a pure Node.js CLI — drop it in any Node pipeline to spot-check compiled `.pyc` against expected sources, or to extract and diff shipped bytecode.
- **Learning tool.** Inspect how CPython lowers a given Python feature (comprehensions, pattern matching, exception groups) across versions. `--asm` is handy here.
- **Batch processing.** Feed a `.zip` of `.pyc` files and get back a mirrored tree of `.py` sources.

## Why depyo (vs alternatives)

| Tool                  | Versions              | Modern features¹ | Runtime | Throughput | Notes                                        |
| --------------------- | --------------------- | ---------------- | ------- | ---------- | -------------------------------------------- |
| **depyo**             | 1.0–3.15 + PyPy       | Yes              | Node.js | ~0.1 ms/file² | Modern opcodes land fast; no Python needed |
| uncompyle6/decompyle3 | 2.x–3.12 (stalled)    | Partial          | Python  | slower     | Development largely halted on 3.13+          |
| pycdc (C++)           | 2.x–3.x (limited new) | Partial          | native  | fast       | Rich history, but slow to adopt new opcodes  |

¹ match/case, walrus, f-strings, exception groups, async/await, type params.
² Informal: `py314_exception_groups.pyc` × 50 in-process, Node 25, single thread (`--stats` on your machine for real numbers).

## Install

```bash
npm i -g depyo          # global CLI
npx depyo <file.pyc>    # one-off, no install
```

Node.js 20+ recommended (CI gate).

## Quick start

```bash
# Single .pyc → writes <name>.py next to it
node depyo.js /path/to/file.pyc

# ZIP of .pyc files → mirrors structure
node depyo.js my_archive.zip

# Also emit disassembly and preserve the raw .pyc
node depyo.js --asm --raw my_archive.zip

# Stream to stdout (no files written)
node depyo.js --out /path/to/file.pyc

# Flatten outputs (drop mirrored directories)
node depyo.js --skip-path /path/to/file.pyc

# Headerless marshal blob (no .pyc magic)
node depyo.js --marshal --py-version 3.11 /path/to/blob.bin
node depyo.js --marshal /path/to/blob.bin            # auto-scan
node depyo.js --marshal-scan /path/to/blob.bin       # fast scan, no decompile
```

Without `--py-version`, depyo scans supported versions (oldest → newest) and accepts the first clean output when all clean candidates agree. If outputs diverge (ambiguous), it stops and asks for `--py-version`. Use `--debug` to see scan results.

## Example

Input `greet.py`:

```python
async def greet(names: list[str], *, greeting: str = "Hello") -> None:
    seen = set()
    for name in names:
        if name in seen:
            continue
        seen.add(name)
        print(f"{greeting}, {name}!")
```

Compile (`python3.13 -c 'import py_compile; py_compile.compile("greet.py", "greet.pyc")'`) then:

```bash
$ npx depyo --out greet.pyc
async def greet(names: list[str], *, greeting: str = "Hello") -> None:
    seen = set()
    for name in names:
        if name in seen:
            continue
        seen.add(name)
        print(f"{greeting}, {name}!")
```

Pattern matching round-trips too:

```python
match command.split():
    case [action]:
        run(action)
    case [action, obj] if action in VERBS:
        run(action, obj)
    case _:
        print("usage: ...")
```

## CLI options

| Option                   | Effect                                                          |
| ------------------------ | --------------------------------------------------------------- |
| `--asm`                  | Emit `.pyasm` disassembly alongside source                      |
| `--raw`                  | Copy raw `.pyc` next to output                                  |
| `--raw-spacing`          | Preserve blank-line / comment gaps                              |
| `--dump`                 | Dump the marshalled object tree                                 |
| `--stats`                | Print throughput stats                                          |
| `--skip-source-gen`      | Skip writing `.py` (useful with `--asm`/`--dump`)               |
| `--skip-path`            | Flatten output paths (write next to input)                      |
| `--out`                  | Print source to stdout instead of files                         |
| `--marshal`              | Treat input as raw marshalled data (no `.pyc` header)           |
| `--marshal-scan`         | Fast scan marshal blobs; print candidate versions               |
| `--py-version <x.y>`     | Bytecode version hint (required for some headerless marshals)   |
| `--basedir <dir>`        | Override output root (default: alongside input)                 |
| `--file-ext <ext>`       | Change emitted extension (default `py`)                         |

## Programmatic API

```js
const {PycReader} = require('depyo/lib/PycReader');
const {PycDecompiler} = require('depyo/lib/PycDecompiler');

const fs = require('fs');
const buffer = fs.readFileSync('greet.pyc');
const reader = new PycReader(buffer);
const obj = reader.ReadObject();

const decompiler = new PycDecompiler(obj);
const ast = decompiler.decompile();
console.log(ast.codeFragment().toString());
```

## Support matrix

- **Python 1.0–3.15** opcode tables and expected fixtures.
- **Modern features:** match/case (guards, OR-patterns, bindings, wildcards), walrus, f-strings (nested, equals-sign debug), exception groups (`except*`), async comprehensions, type parameters, PEP 696 TypeVar defaults, PEP 750 t-strings.
- **PyPy** bytecode decompiles; expected fixtures not yet part of CI.
- **CI gates:** Modern feature checks are blocking; legacy 1.x / 2.7 / 3.0–3.6 smokes gate as well.

## Known limitations

- **Inline comprehensions (3.12+):** PEP 709 inlines list/dict/set comprehensions into the parent code object. Depyo currently reconstructs these as for-loops rather than comprehension expressions. Functions, classes, match/case, exception handling, and other constructs work correctly.
- **Comments / blank lines:** Lost in compilation and not recoverable. `--raw-spacing` can hint at original gaps using line-number attributes.
- **Source-level AST drift:** Some constructs are normalized by CPython before bytecode (e.g. `if not x: raise AssertionError` ↔ `assert x`). Depyo renders what the compiler produced.

## Testing

```bash
# Smoke per version
node scripts/run-fixtures.js --root test/bytecode_3.14 --pattern py314_with_except_star --fail-fast
node scripts/run-fixtures.js --root test/bytecode_3.6  --pattern py36_fstrings          --fail-fast

# Full matrix
node scripts/run-matrix.js
node scripts/run-matrix.js --pattern py311_exception_groups --fail-fast

# Marshal-blob fixtures (headerless)
node scripts/run-marshal-fixtures.js

# Regenerate snapshot fixtures (destructive)
node scripts/generate-marshal-fixtures.js --clean

# Tier-1 oracle: parseability of every decompiled fixture
node scripts/check-parseable.js

# Tier-2 oracle: AST equivalence between source .py and decompiled .py
node scripts/check-ast-equivalence.js

# Sentinel leak gate (CI-critical)
node scripts/check-no-sentinels.js
```

Modern fixtures are generated via `test/generate_modern_tests.py` (Python 3.8+ on PATH).

## Contributing

- Use `node scripts/run-fixtures.js --pattern <piece>` for fast repros.
- For full coverage, `node scripts/run-matrix.js --fail-fast` (optionally add `--pattern`).
- `--raw-spacing` helps inspect potential comment/blank-line gaps.
- `--stats` helps when profiling throughput.

Issues, repro `.pyc` files, and PRs welcome at https://github.com/skuznetsov/depyo.js/issues.

Comments and docs are in English; output mirrors the target Python version syntax.

## License

MIT — see [LICENSE](LICENSE).
