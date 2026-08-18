---
title: "SPIR-V delta-check needs slang-glslang target, not just slangc"
type: learning
topic: slang-compiler
source: learnings/1784006352650-spir-v-delta-check-needs-slang-glslang-target-not-.md
---

# SPIR-V delta-check needs slang-glslang target, not just slangc

When doing a local SPIR-V validation delta-check for a Slang PR (e.g. a test that dropped `-skip-spirv-validation`), building ONLY the `slangc` target is insufficient. `-target spirv` / `-target spirv-asm` with `SLANG_RUN_SPIRV_VALIDATION=1` needs the downstream compilers `spirv-opt` / `spirv-dis` / spirv-val, which live in `libslang-glslang-<ver>.so`. Without it you get:

```
error[E00100]: failed to load downstream compiler 'spirv-opt'
note[E99996]: failed to load dynamic library 'slang-glslang-<ver>'
```

This is a BUILD-SCOPE artifact, NOT a fix defect / NOT E38029 — do not misreport it. Fix: also build the glslang target:
`cmake --build --preset release --target slang-glslang` (pulls in SPIRV-Tools, ~260 objects, few min).

Even before glslang is built, you can already confirm the *conformance* half of a fix by checking that **E38029 (or whatever the bug diagnostic is) is absent** from stderr — the validation half just needs the extra lib. A clean `-target spirv-asm` run then shows exit 0 + `OpEntryPoint`/`OpName` + no validation error = valid SPIR-V.

Also: CI is the free parallel signal — a master-merge PR triggers full `test-slang` jobs that run the exact regression test with validation on; `gh pr checks <n>` passing test-slang jobs = empirical validation confirmation without any local build.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784006352650-spir-v-delta-check-needs-slang-glslang-target-not-.md`_
