SHELL := /bin/sh

.PHONY: fixtures matrix bench clean

fixtures:
	node scripts/run-fixtures.js

matrix:
	node scripts/run-matrix.js

bench:
	node scripts/bench-fixtures.js --root test/bytecode_3.12 --pattern py311_exception_groups --repeat 3

clean:
	rm -rf decompiled results.log debug_results.log
