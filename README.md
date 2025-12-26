# depyo — Python bytecode decompiler in Node.js

Depyo converts Python `.pyc` files (or archives of them) back to readable Python source. It aims for broad coverage (Python 1.0 through 3.14) and fast throughput, with fixtures for modern features (exception groups, pattern matching, walrus, f-strings, async, context managers).

## Why depyo?
- **Wide version coverage:** Opcode tables and expected outputs for Python 1.0–3.14, plus decompilation support for PyPy bytecode sets.
- **Modern features:** WITH_EXCEPT_START/PREP_RERAISE_STAR, async/await, walrus, match/case, f-strings, type params, dict/set merges.
- **Workflow friendly:** CLI options for asm dumps, raw spacing hints, raw `.pyc` preservation, and flattened output paths.
- **Verification harness:** `run-fixtures.js` and `run-matrix.js` compare decompiled output against expected fixtures across versions.

## Install
- Global: `npm i -g depyo`
- One-off: `npx depyo <file.pyc>`

Node.js 20+ recommended (matches CI).

## Quick start

```bash
# Decompile a single .pyc
node depyo.js /path/to/file.pyc

# Decompile a zip of .pyc files, emit asm and keep raw bytes
node depyo.js --asm --raw my_archive.zip

# Write sources next to inputs (skip directory mirroring)
node depyo.js --skip-path /path/to/file.pyc

# Dump to stdout instead of files
node depyo.js --out /path/to/file.pyc

# Marshal-only blob (no .pyc header)
node depyo.js --marshal --py-version 3.11 /path/to/blob.bin
node depyo.js --marshal /path/to/blob.bin
```
Without `--py-version`, depyo scans supported versions (oldest → newest) and accepts the first clean output when all clean candidates agree. If outputs diverge (ambiguous), it stops and asks for `--py-version`. Use `--debug` to see scan results.

### CLI options
- `--asm` emit `.pyasm` disassembly alongside source
- `--raw` emit raw `.pyc` next to output
- `--raw-spacing` preserve blank lines/comment gaps
- `--dump` dump marshalled object tree
- `--stats` print throughput stats
- `--skip-source-gen` skip writing `.py` (use with `--asm/--dump`)
- `--skip-path` flatten output paths (write next to input)
- `--out` print source to stdout instead of files
- `--marshal` treat input as raw marshalled data (no .pyc header, auto-scan versions)
- `--py-version <x.y>` bytecode version hint (use with `--marshal`)
- `--basedir <dir>` override output root (default: alongside input)
- `--file-ext <ext>` change emitted extension (default `py`)

## Examples
- Disassemble only (no source): `node depyo.js --skip-source-gen --asm file.pyc`
- Keep raw + disassembly next to source: `node depyo.js --raw --asm path/to/file.pyc`
- Flatten outputs (helpful for bulk zips): `node depyo.js --skip-path archive.zip`

## Testing
- Smoke per version:
  ```bash
  node scripts/run-fixtures.js --root test/bytecode_3.14 --pattern py314_with_except_star --fail-fast
  node scripts/run-fixtures.js --root test/bytecode_3.6 --pattern py36_fstrings --fail-fast
  ```
- Matrix (all versions, optional PyPy):
  ```bash
  node scripts/run-matrix.js                  # full sweep
  node scripts/run-matrix.js --pattern py311_exception_groups --fail-fast
  ```
- Marshal fixtures (headerless marshal blobs):
  ```bash
  node scripts/run-marshal-fixtures.js
  ```
- Regenerate marshal fixtures:
  ```bash
  node scripts/generate-marshal-fixtures.js --clean
  ```
- Modern fixtures are generated via `test/generate_modern_tests.py` (Python 3.8+ on PATH).

## Support matrix
- Python 1.0–3.14 opcode tables with expected fixtures.
- Modern features: match/case, walrus, f-strings, exception groups, type params.
- PyPy bytecode sets decompile; expected files are not yet part of CI.
- Legacy CI smokes (1.x/2.7/3.0–3.6) are informational (`continue-on-error`); modern feature checks are blocking.

## Known limitations
- **Inline comprehensions (Python 3.12+):** PEP 709 inlines list/dict/set comprehensions into parent code objects. Depyo currently reconstructs these as for-loops rather than comprehension expressions. Functions, classes, match/case, exception handling, and other constructs work correctly.

## Contributing / DX tips
- Use `node scripts/run-fixtures.js --pattern <piece>` for fast repros.
- For full coverage, `node scripts/run-matrix.js --fail-fast` (optionally add `--pattern`).
- Enable `--raw-spacing` to inspect potential comment/blank-line gaps.
- `--stats` helps when profiling throughput.

Comments and docs are in English; output mirrors the target Python version syntax.

## Comparison snapshot (at a glance)

| Project            | Supported versions          | Modern features (match, walrus, f-strings, exc groups) | Delivery     | Expected fixtures | Notes                                     |
| ------------------ | --------------------------- | ------------------------------------------------------ | ------------ | ----------------- | ----------------------------------------- |
| depyo              | 1.0–3.14 (PyPy decompiles)  | Yes                                                    | npm/npx, CLI | Yes (1.0–3.14)    | Node.js CLI, asm/raw-spacing options      |
| uncompyle6/decompyle3 | 2.x–3.12+ (lag on 3.13/3.14) | Partial (depends on branch)                           | pip          | Partial           | Python-based, slower adoption of new ops  |
| pycdc (C++)        | Mostly 2.x–3.x (limited new) | Partial                                                | source build | No                | Fast, but modern coverage limited         |

## Quick benchmark (informal)
- Machine: local Node 25, single-thread.
- Case: `py314_exception_groups.pyc` decompiled 50× in-process: ~5.3 ms total (≈0.1 ms per decompile).  
Use `node depyo.js --stats <file.pyc>` for your environment.

## Promotion ideas (OSS)
- Announce on HN/Reddit (Show HN / r/Python) with npm/npx one-liners.
- Add to awesome lists (`awesome-python`, `awesome-reverse-engineering`).
- Provide asciinema/GIF of `npx depyo file.pyc` + `--asm`.
- Encourage contributions via Issues/Discussions and `help wanted` labels.
