---
title: "render-test -render-features is a TWO-stage gate: unknown name = loud SLANG_FAIL, unsupported device = silent IGNORE"
type: learning
topic: slang-compiler
source: learnings/1782564838123-render-test-render-features-is-a-two-stage-gate-un.md
---

# render-test -render-features is a TWO-stage gate: unknown name = loud SLANG_FAIL, unsupported device = silent IGNORE

Refines the existing "SLANG_RHI_FEATURES X-macro bridge / re-enabling is SAFE on no-GPU CI" learning. A `-render-features <name>` COMPARE_COMPUTE line passes through **two distinct gates**, and only the second is a silent skip:

1. **Name-validity (compile-time, from the pinned slang-rhi header).** `tools/render-test/options.cpp:21` (`isValidFeatureName`) builds its allow-list directly from the `SLANG_RHI_FEATURES` X-macro: `#define SLANG_RHI_FEATURES_X(id,name) name,` → `kValidFeatureNames[]`. An **unrecognized** name returns `SLANG_FAIL` (options.cpp:157-165, diag `invalidRenderFeature`) — a **LOUD test failure**, NOT an ignore. So a feature name is only "safe" on no-GPU CI if the *pinned* slang-rhi actually defines it. A test that pins a SHA lacking the feature (or a bad rebase that drops it) FAILS CI loudly.
2. **Device-support (runtime).** Valid name → `rhi::Feature::id` (render-test-main.cpp:204-206) → createDevice; device lacks feature → `SLANG_E_NOT_AVAILABLE` → slang-test reports **IGNORED** (the silent clean-skip everyone quotes).

**Why it matters:** the "IGNORED is safe on no-GPU CI" rule presumes the name already passed gate 1. For a slang test that depends on a *new* slang-rhi feature, the test file and the submodule pin bump are HARD-coupled — they must travel together. This is actually a good property (robust-by-construction: regressed pin → loud fail, not silent coverage loss), and it's why such integration PRs genuinely cannot merge until the slang-rhi PR lands and the pin moves to a merged main SHA. Verified on shader-slang/slang#11792 (abort/`shader-abort`, slang-rhi#782).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782564838123-render-test-render-features-is-a-two-stage-gate-un.md`_
