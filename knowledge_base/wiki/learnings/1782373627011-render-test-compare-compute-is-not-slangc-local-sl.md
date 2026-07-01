---
title: "render-test (COMPARE_COMPUTE) is not slangc — local slangc pass does not predict the runtime lane"
type: learning
topic: slang-compiler
source: learnings/1782373627011-render-test-compare-compute-is-not-slangc-local-sl.md
---

# render-test (COMPARE_COMPUTE) is not slangc — local slangc pass does not predict the runtime lane

When a `.slang` test has a `//TEST(compute):COMPARE_COMPUTE(...):-vk ...` lane, that lane runs under **render-test** (the GPU runtime harness), NOT `slangc`. They are different programs with different contracts, so "I ran slangc locally and it's fine" does NOT predict whether the COMPARE_COMPUTE lane passes in CI. This caused a 4-round churn on slang PR #11735 (#11731): I added `-warnings-disable 41012` to silence a profile-upgrade warning — valid for slangc/SIMPLE lanes, but render-test **rejects** it with `error 1004: unknown command-line option '-warnings-disable'`, so CI produced an empty buffer.

Two concrete render-test divergences from slangc:
1. **Different option set.** render-test rejects `slangc`/SIMPLE-only flags like `-warnings-disable`. Don't assume a slangc-accepted flag works on a COMPARE_COMPUTE lane — verify it actually runs the render-test binary, or just don't put compiler-frontend flags on the runtime lane.
2. **stderr is diffed against empty.** COMPARE_COMPUTE diffs the result buffer (via filecheck-buffer) AND diffs stdout/stderr against an empty-expected. So **any** compile-time diagnostic the run emits (e.g. E41012 "profile implicitly upgraded" under `-profile spirv_1_3`) fails the lane — even when the shader compiles and the GPU produces the correct result. The atomics executed fine locally and returned the expected buffer; only the unsuppressable warning's stderr-diff blocked the legacy-profile lane.

Practical rule: a runtime lane that needs a non-default profile (e.g. `spirv_1_3` to force the legacy Uniform/BufferBlock SSBO path) may be un-runnable in CI purely because of an unsuppressable warning, independent of correctness. The robust split is: keep the runtime smoke test on the **default** profile (proves the ops execute), and put the profile-specific assertions on a static `SIMPLE(filecheck=...):-profile <p> -target spirv` FileCheck lane (SIMPLE does not diff stderr, so warnings don't fail it). Don't conflate "slangc compiles it locally" with "the COMPARE_COMPUTE lane is green."

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782373627011-render-test-compare-compute-is-not-slangc-local-sl.md`_
