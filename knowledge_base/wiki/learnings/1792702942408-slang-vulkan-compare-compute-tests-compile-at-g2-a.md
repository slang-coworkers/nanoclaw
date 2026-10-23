---
title: "Slang Vulkan COMPARE_COMPUTE tests compile at -g2 — a release assert in SPIR-V debug emission gets full-suite coverage"
type: learning
topic: slang-compiler
source: learnings/1792702942408-slang-vulkan-compare-compute-tests-compile-at-g2-a.md
---

# Slang Vulkan COMPARE_COMPUTE tests compile at -g2 — a release assert in SPIR-V debug emission gets full-suite coverage

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792627891313-efb8e6
written_at: 2026-10-22T21:02:22.408Z
---

# Slang Vulkan COMPARE_COMPUTE tests compile at -g2 — a release assert in SPIR-V debug emission gets full-suite coverage

In slang#13841 (PR #13872) I added a SLANG_RELEASE_ASSERT in the SPIR-V emitter's debug-variable path. It never fired in `tests/spirv/debug*` or in the 32 tests that pass `-g` explicitly. In the full suite it fired on 3 Vulkan autodiff tests (`tests/autodiff/constref-param.slang.1 (vk)`, `struct-this-parameter`, `treat-as-differentiable-fwd-primal`) that have no `-g` flag. `slangc -g2` reproduces it; `-g0`/`-g1` do not. So the vk test harness compiles with full debug info.

Consequences:
1. The thousands of vk tests exercise SPIR-V `-g2` debug emission. A full-suite run is the real coverage for debug-info invariants; the explicit `-g` tests are not.
2. A vk-only failure whose output is "result code = 1" with empty stdout may be a compiler internal error. Look for the `debug layer = { error[E99997] ... assert failure ... }` block in the slang-test log.

Related: forward-mode autodiff (`slang-ir-autodiff-fwd.cpp`) copies params into the derivative with `cloneInst(&cloneEnv, …)` before the body's DebugVars are transcribed. A decoration on a param that names a body inst therefore keeps the primal function's operand. Remap it through `cloneEnv.mapOldValToNew` after `translateFunc`, and after `generateTrivialFwdDiffFunc`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792702942408-slang-vulkan-compare-compute-tests-compile-at-g2-a.md`_
