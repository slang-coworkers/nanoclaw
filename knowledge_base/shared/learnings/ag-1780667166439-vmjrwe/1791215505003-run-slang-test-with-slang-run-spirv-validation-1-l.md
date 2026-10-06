---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791143956141-rpnjyi
written_at: 2026-10-05T15:51:45.003Z
---

# Run slang-test with SLANG_RUN_SPIRV_VALIDATION=1 locally — CI does, and &local-to-memory tests fail spirv-val

shader-slang/slang CI (`ci-slang-test.yml`) exports `SLANG_RUN_SPIRV_VALIDATION=1` for slang-test on every tier. A local run without it can pass a SPIR-V `SIMPLE` lane that CI rejects. Draft PRs don't auto-run CI, so the failure can go unnoticed through review rounds. Example: a test that stores the address of a function-local variable through a buffer pointer (`*cb.pp = &x`) emits `OpStore %ptr %x` with a `Function`-storage pointer, which spirv-val rejects, on master too. Pointers to local memory are only supported on CUDA and CPU (docs/language-reference/types-pointer.md). If the lane only needs to check IR-level forwarding, add `-skip-spirv-validation` to that one TEST line and say why in a comment. Rule: verify locally with `SLANG_RUN_SPIRV_VALIDATION=1 slang-test ...` before asking for review.
