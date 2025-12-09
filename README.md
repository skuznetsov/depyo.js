# depyo — Python bytecode decompiler in Node.js

Depyo decodes Python `.pyc` files (and zip archives containing them) into readable Python source. It targets breadth (Python 1.0 through 3.14) and speed, with fixtures that mirror real-world bytecode patterns and modern features (exception groups, pattern matching, walrus, f-strings, async, context managers).

## Features
- Handles Python bytecode 1.0–3.14 (plus PyPy sets) with opcode tables per version.
- Exception-group aware (WITH_EXCEPT_START/PREP_RERAISE_STAR), async/await, walrus, pattern matching, f-strings, dict/set merges, type params.
- CLI flags for raw spacing, disassembly (`--asm`), raw dumps, and flattened output paths.
- Fixture runners (`scripts/run-fixtures.js`, `scripts/run-matrix.js`) to diff decompiled output against expected baselines.

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

Key flags:
- `--asm` emit `.pyasm` disassembly alongside source
- `--raw` emit raw `.pyc` next to output
- `--raw-spacing` preserve blank lines/comments spacing hints
- `--dump` dump marshalled object tree
- `--stats` print throughput stats
- `--skip-source-gen` skip writing `.py` (useful with `--asm`/`--dump`)
- `--basedir <dir>` override output root
- `--file-ext <ext>` change emitted extension (default `py`)

## Testing
Smoke per version:
```bash
node scripts/run-fixtures.js --root test/bytecode_3.14 --pattern py314_with_except_star --fail-fast
node scripts/run-fixtures.js --root test/bytecode_3.6 --pattern py36_fstrings --fail-fast
```

Matrix (all versions, optional PyPy):
```bash
node scripts/run-matrix.js                  # full sweep
node scripts/run-matrix.js --pattern py311_exception_groups --fail-fast
```

Modern fixtures are generated via `test/generate_modern_tests.py` (Python 3.8+ available on PATH).

## Support matrix
- Python 1.0–3.14 opcode tables with expected fixtures; legacy CI smokes are non-blocking to surface regressions without breaking builds.
- Modern features (match, walrus, f-strings, exception groups, type params) covered by targeted fixtures.
- PyPy bytecode sets are decompiled; expected files are not yet part of CI.

## Notes
- CI exercises modern features and legacy smoke runs (1.x, 2.7, 3.0–3.5, 3.4, 3.6); legacy steps are non-blocking to surface regressions without breaking builds.
- Comments and docs are kept in English; code output mirrors Python syntax for the target version.
