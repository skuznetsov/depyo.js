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
```

### CLI options
- `--asm` emit `.pyasm` disassembly alongside source
- `--raw` emit raw `.pyc` next to output
- `--raw-spacing` preserve blank lines/comment gaps
- `--dump` dump marshalled object tree
- `--stats` print throughput stats
- `--skip-source-gen` skip writing `.py` (use with `--asm/--dump`)
- `--skip-path` flatten output paths (write next to input)
- `--out` print source to stdout instead of files
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
- Modern fixtures are generated via `test/generate_modern_tests.py` (Python 3.8+ on PATH).

## Support matrix
- Python 1.0–3.14 opcode tables with expected fixtures.
- Modern features: match/case, walrus, f-strings, exception groups, type params.
- PyPy bytecode sets decompile; expected files are not yet part of CI.
- Legacy CI smokes (1.x/2.7/3.0–3.6) are informational (`continue-on-error`); modern feature checks are blocking.

## Contributing / DX tips
- Use `node scripts/run-fixtures.js --pattern <piece>` for fast repros.
- For full coverage, `node scripts/run-matrix.js --fail-fast` (optionally add `--pattern`).
- Enable `--raw-spacing` to inspect potential comment/blank-line gaps.
- `--stats` helps when profiling throughput.

Comments and docs are in English; output mirrors the target Python version syntax.
