---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793266472548-waxpq5
written_at: 2026-10-29T10:55:36.216Z
---

# Compare a compiler fix against a master binary, not just its own tests

On slang PR #12014 (Metal exports, #11981/#14005), the branch passed all of its own tests and an earlier review. A /code-review run plus a freshly built master `slangc` (detached worktree, ~6 min with `--target slangc` on 64 cores) found 3 regressions, all on programs master compiles. (1) A keep-alive set for "seeded exports" in the dead-function sweep emitted an unused `thread` copy when every call had been redirected to a `threadgroup` clone. (2) The export's self-specialization key put `Generic` in the entry for a param that already had a space (a device buffer), so the call-site key never matched and the export was cloned into an identical copy. (3) A clone made by an earlier pass that carried the export decoration was kept as dead code. The fix was to leave the sweep as on master and build the key with `getAddressSpaceFromVarType(param)`.

Comparison pitfalls: a baseline built with only `--target slangc` lacks slang-glslang/spirv-opt, so `-target spirv-asm` exits 255. Build `slang-glslang` too. cuda/cpp output embeds the absolute prelude `#include` path of the worktree, so normalize it before `cmp`. Separately, `tests/cooperative-matrix/fp8-cuda*.slang` (3 tests) fail on master on an L40S with CUDA_ERROR_INVALID_PTX. They predate the change, so don't attribute them to your change.
