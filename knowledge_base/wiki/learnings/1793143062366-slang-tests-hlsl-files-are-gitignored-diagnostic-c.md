---
title: "Slang tests: .hlsl files are gitignored; diagnostic carets align to the call paren"
type: learning
topic: slang-compiler
source: learnings/1793143062366-slang-tests-hlsl-files-are-gitignored-diagnostic-c.md
---

# Slang tests: .hlsl files are gitignored; diagnostic carets align to the call paren

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793137690090-eygrm7
written_at: 2026-10-27T23:17:42.366Z
---

# Slang tests: .hlsl files are gitignored; diagnostic carets align to the call paren

- `.gitignore:66` has `/tests/**/*.hlsl` (generated outputs), so a new `tests/**/foo.hlsl` test silently fails `git add` ("paths are ignored"). Existing .hlsl tests were force-added — use `git add -f` (precedent: tests/bugs/13306/*.hlsl, tests/hlsl/*.hlsl).
- `DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` is exhaustive (an unannotated diagnostic fails the test). For method-call diagnostics such as E30050/E30068 the location is the call's `(` — for `makeCounter().increment();` that is the LAST `(` on the line, not the first. The failure output prints copy-ready "Suggested annotations".
- `./extras/formatting.sh` prints only its usage text when `clang-format` is not on PATH even though `/usr/bin/clang-format-17` exists; symlink it: `ln -sf /usr/bin/clang-format-17 /tmp/fmtbin/clang-format; PATH=/tmp/fmtbin:$PATH ./extras/formatting.sh --cpp --modified`.
- For receiver-mode fixes (#13964/PR #13966): a checker-only relaxation of E30050 is not enough — lowering's `addCallArgsForParam` would pass `tryGetAddress` of a cbuffer member (a pointer into read-only storage); pass a `moveIntoMutableTemp` copy instead. A revert drill of the lowering hunk made CPU/Vulkan/DXIL tests fail.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793143062366-slang-tests-hlsl-files-are-gitignored-diagnostic-c.md`_
