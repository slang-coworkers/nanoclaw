---
title: "COMPARE_COMPUTE filecheck-buffer: use -output-using-type or CI (cpu+llvm) dumps HEX while local (gcc cpu) dumps decimal"
type: learning
topic: ci-tooling
source: learnings/1781271132976-compare-compute-filecheck-buffer-use-output-using-.md
---

# COMPARE_COMPUTE filecheck-buffer: use -output-using-type or CI (cpu+llvm) dumps HEX while local (gcc cpu) dumps decimal

A slang COMPARE_COMPUTE regression test passed locally (`-cpu`) but failed on EVERY CI test-slang platform (slang-fixer, 2026-06-12, PR #11569).

**Symptom:** `slang-test: ...:NN: error: CHECK: expected string not found in input` / `// CHECK: 30` / `actual-output: ... scanning from here / 1E`. The readback value was `1E` — that's **hex for 30** (`0x1E`).

**Root cause:** `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu -compute -entry computeMain` WITHOUT `-output-using-type` dumps the output buffer as **raw hex words**. CI's CPU job runs `-api cpu+llvm` (the LLVM JIT backend) which emits hex; the LOCAL `-cpu` path here uses the gcc/genericcpp backend which happens to emit **decimal** — so the test passed locally and failed in CI. Values `6` and `9` are identical in hex/decimal, so only a value like `30`(=`1E`) exposes the mismatch (and FileCheck fails on the first unmatched CHECK).

**Fix:** add `-output-using-type` to the directive (the documented pattern in CLAUDE.md / `tests/.../lambda-0.slang`). It makes slang-test format the readback by the resource's element TYPE (int → decimal `30`) regardless of backend, so it matches on both gcc and llvm.

**Reusable rules:**
- For any COMPARE_COMPUTE `filecheck-buffer` test whose CHECKed integer values can exceed 9 / differ between hex and decimal, ALWAYS use `-output-using-type`. (A single-slot boolean `1` or values ≤ 9 will mask the bug — the round-1 version of this very test used `1` and passed CI.)
- A local `-cpu` pass does NOT guarantee CI: the LLVM CPU backend (`-api cpu+llvm`) is not reproducible on a box whose `slang-test` backends list lacks `llvm` (banner shows only `clang gcc genericcpp`). Treat buffer-format-sensitive tests as CI-verified, not locally-verified, unless you force `-output-using-type`.
- DIAGNOSTIC_TEST (parse-error pins) are backend-agnostic and were unaffected — only the COMPARE_COMPUTE buffer formatting bit.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1781271132976-compare-compute-filecheck-buffer-use-output-using-.md`_
