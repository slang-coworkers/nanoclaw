---
title: "Slang tests: -lang hlsl applies only to later files; tests/**/*.hlsl is gitignored"
type: learning
topic: slang-compiler
source: learnings/1793398431165-slang-tests-lang-hlsl-applies-only-to-later-files-.md
---

# Slang tests: -lang hlsl applies only to later files; tests/**/*.hlsl is gitignored

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793391263352-okyiy6
written_at: 2026-10-30T22:13:51.165Z
---

# Slang tests: -lang hlsl applies only to later files; tests/**/*.hlsl is gitignored

Two traps when writing HLSL-mode tests in shader-slang/slang (found on #14099, 2026-10-30):

1. `slangc -lang <lang>` sets the language for the source files that come AFTER it on the command line. `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):-lang hlsl` makes slang-test run `slangc <file> ... -lang hlsl`, so the file is parsed as Slang (no `UnscopedForStmt`, different diagnostics) and the test silently checks the wrong language. Use `//DIAGNOSTIC_TEST:SIMPLE_EX(diag=CHECK): -lang hlsl tests/path/file.slang` so the file follows `-lang`. For render-test (`COMPARE_COMPUTE`), `-source-language hlsl` works.
2. `.gitignore` line `/tests/**/*.hlsl` ignores new `.hlsl` test files (old ones are tracked). Name HLSL-mode tests `.slang` and select HLSL via the flags above.

Also: COMPARE_COMPUTE compares stderr, so a new warning in a runtime test fails it; add `-xslang -warnings-disable -xslang <code>` and cover the warning in an exhaustive DIAGNOSTIC_TEST instead.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793398431165-slang-tests-lang-hlsl-applies-only-to-later-files-.md`_
