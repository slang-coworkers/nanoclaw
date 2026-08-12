---
title: "Perf regression bisected to a fix ≠ the fix's logic is the cost (byte-compare serialized artifacts to distinguish semantic vs LTO-layout)"
type: learning
topic: verification
source: learnings/1783349482128-perf-regression-bisected-to-a-fix-the-fix-s-logic-.md
---

# Perf regression bisected to a fix ≠ the fix's logic is the cost (byte-compare serialized artifacts to distinguish semantic vs LTO-layout)

**Context:** slang #11952 — module_link compile-perf bench regressed ~+5% (271→283 ms), single-commit-bisected to #11921, whose ONLY runtime change is `Path::getRelativePath` returning the original path instead of `""` when `std::filesystem::relative` yields empty (slang-io.cpp:747). Reporter (perf-CI owner) hypothesized "added per-dependency path work at load."

**Key insight — a clean bisect proves WHICH commit, not the MECHANISM.** The author's per-phase-timer attribution (readSerializedModuleIR +8%, checkAllTranslationUnits +13%) was an inference, not a measurement of the cause.

**How to root-cause a perf regression whose culprit change is tiny:**
1. Trace where the changed function is actually CALLED. `getRelativePath` is called ONLY at module-SAVE time (`encodeModuleDependencyPaths`, slang-serialize-container.cpp) — never on the load path, and NOT during the timed compile (which imports pre-built `.slang-module`s and emits SPIR-V, serializing nothing). So it cannot affect the timed binary *by executing*.
2. Determine whether the change alters the SERIALIZED OUTPUT. `std::filesystem::relative(p,base)` returns empty on Linux only when one input is absolute and the other relative (verified empirically); the benchmark's paths are `getCanonical`-ed to absolute, so the changed empty-branch is never hit. Confirmed by replicating the precompile and `strings`-ing the `.slang-module`: stored dep path is a non-empty relative path → identical old-vs-new.
3. **Elimination:** if a source change's only channel to the hot binary is (a) executing in the hot path — ruled out — or (b) changing serialized data consumed by the hot path — ruled out (bytes identical) — then a real, reproducible regression is a **codegen/LTO-layout artifact** (function reorder/inlining shift under `-DSLANG_ENABLE_RELEASE_LTO=ON`). A tiny edit to one function relayouts the whole LTO binary and can shift a short (~270 ms) workload a few %.

**Decisive experiment to hand the fixer:** build both commits, precompile the same fixture with each slangc, `cmp` the `.slang-module` outputs. Identical bytes ⇒ layout artifact (don't implement per-dependency caching — it won't recover the time; re-baseline or investigate LTO ordering). Differ ⇒ the semantic mechanism is real; then optimize the load-side `isBinaryModuleUpToDate` per-dependency resolve→read→hash loop (slang-session.cpp:1863-1892), which is genuine O(imports×deps) work but is otherwise unchanged by the culprit.

Applies broadly: for any bisected perf regression on an LTO build where the culprit diff is small and touches a cold function, byte-compare the relevant build artifacts before assuming the diff's logic is the cost.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1783349482128-perf-regression-bisected-to-a-fix-the-fix-s-logic-.md`_
