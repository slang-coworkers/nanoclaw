---
title: "SPIR-V snippet emit tests: FileCheck-local-ignore, half-hex-vs-float-decimal, test-only string snippets"
type: learning
topic: slang-compiler
source: learnings/1789726457708-spir-v-snippet-emit-tests-filecheck-local-ignore-h.md
---

# SPIR-V snippet emit tests: FileCheck-local-ignore, half-hex-vs-float-decimal, test-only string snippets

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789715716703-8acjps
written_at: 2026-09-18T10:14:17.708Z
---

# SPIR-V snippet emit tests: FileCheck-local-ignore, half-hex-vs-float-decimal, test-only string snippets

While fixing shader-slang/slang#13168 (un-emittable `__target_intrinsic(spirv,"…")` snippet operands crashing at emit), three non-obvious things about testing/verifying SPIR-V snippet emit locally:

1. **The GPU-less local harness silently IGNORES `filecheck=` SIMPLE tests** — `slang-test` prints `FileCheck is not available` and reports `0/0, 1 ignored` because the external LLVM `FileCheck` binary isn't installed. This is NOT a GPU/device issue (vk/cpu/cuda all probe "Supported"). `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` tests use slang-test's BUILT-IN matcher and DO run. So for GPU-less local verification of a diagnostic, prefer `diag=CHECK`; for a positive `filecheck=CHECK` spirv-asm test, verify the expected output directly via `slangc -target spirv-asm …` (it runs in CI regardless).

2. **The spirv-asm disassembler prints half constants in HEX but float constants in DECIMAL** — a `const(half,0.5)` emits `OpConstant %half 0x1p-1` while `const(float,0.5)`/resolved-`_p` emits `OpConstant %float 0.5`. Don't assume both use the same spelling in CHECK lines; match the actual `slangc -target spirv-asm` output.

3. **Zero `__target_intrinsic(spirv,"…")` STRING snippets exist in production source** (grep prelude/ + source/ → 0). The string-snippet form (with `_type(…)`/`const(…)`/`_N` operands) is exercised only by tests and is user-reachable because `__target_intrinsic` is in `baseLanguageScope`. So hardening/diagnosing its operands is regression-free for shipped intrinsics (production SPIRV intrinsics use `spirv_asm { … }` blocks, not this legacy string form).

Bonus git gotcha: `git push --force-with-lease` fails with "stale info" after `git fetch origin <branch>` because fetch updates FETCH_HEAD, not the remote-tracking ref `--force-with-lease` compares against. Use plain `--force` once you've confirmed via `git ls-remote` that the remote tip is your own commit.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789726457708-spir-v-snippet-emit-tests-filecheck-local-ignore-h.md`_
