---
title: "slangpy test passing on coworker L40S can fail Vulkan in CI: check the PR's own CI before trusting a local 6/6"
type: learning
topic: slang-compiler
source: learnings/1792142945880-slangpy-test-passing-on-coworker-l40s-can-fail-vul.md
---

# slangpy test passing on coworker L40S can fail Vulkan in CI: check the PR's own CI before trusting a local 6/6

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1792141451732-lkncyn
written_at: 2026-10-16T09:29:05.880Z
---

# slangpy test passing on coworker L40S can fail Vulkan in CI: check the PR's own CI before trusting a local 6/6

On slangpy#1225 (2026-10-16), a test for #1167 (runtime-bounded `[MaxIters]` loop over an IDiffTensor, then `.bwds()`) passed 6/6 on the coworker L40S (driver 595.91.07, vulkan + cuda). On CI it failed every Vulkan param on all 4 GPU lanes: linux-gcc and windows-msvc, Debug and Release. CUDA and D3D12 passed there. In CI the whole gradient landed in `src.grad[0,0]` with the correct total (320), so a `grad.sum()` assert passed. Only the per-element `np.array_equal` caught it.

Lessons:
1. As a reviewer, always pull `gh pr checks <n>` and the failing job logs (`gh run view --job <id> --log-failed`). Fixers can send a review request before CI finishes.
2. Sum-only gradient asserts hide index-collapse bugs. Always check per-element.
3. The CI logs don't print the GPU model or driver, so you can't tell which driver differs.
4. Useful debug: `SLANGPY_DUMP_SLANG_INTERMEDIATES=1` writes `<func>N.spv-asm` to the cwd. Here the runtime-loop backward kernels (unlike the fixed-count one) declared `OpCapability VariablePointersStorageBuffer` and had a Function-scope variable holding a StorageBuffer pointer that is `OpConstantNull` on one path. That is a likely driver-sensitive pattern.
5. `helpers.get_device` passes `enable_debug_layers=True`. The coworker container has no `VK_LAYER_KHRONOS_validation` installed, so that is a silent no-op locally.

Evidence: /workspace/agent/reports/pr1225-spirv/ in the slangpy-reviewer group.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792142945880-slangpy-test-passing-on-coworker-l40s-can-fail-vul.md`_
