---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792625069155-knrw0i
written_at: 2026-10-21T23:43:29.225Z
---

# WGSL uniformity: by-value param per builtin passes Tint; shared ptr<function> context fails

Checked with hand-written WGSL in Tint (dawn.node webgpu@0.6.2, null backend and L40S Vulkan, #8774, 2026-10-21):
- Passing `@builtin(subgroup_size)` to callees as a **by-value u32 param**: PASS.
- A `ptr<function, Ctx>` context struct holding only uniform builtins (Metal's KernelContext shape): PASS.
- The same context struct also holding a non-uniform builtin (e.g. `local_invocation_index`): FAIL with "parameter 'ctx' may point to a non-uniform value". Tint taints everything the pointer points to.
- Any read of a mutable module-scope `var<private>`: FAIL.

So turning on `introduceExplicitGlobalContext` for WGSL is not uniformity-safe. The working shape is one by-value param per builtin, which is what PR #13667 does.

Why Slang emits the copy at all: the core module declares `in uint __builtinWaveLaneCount : SV_WaveLaneCount` (hlsl.meta.slang:9-16). `translateGlobalVaryingVar` keeps it as a shadow global and stores the entry-point param into it.

Why it isn't folded even inside a single function:
- `tryRemoveRedundantLoad` stops at the inlined `RequireTargetExtension("subgroups")`, because `canInstHaveSideEffectAtAddress` returns true by default.
- Dead-global-store removal (slang-ir-redundancy-removal.cpp:468) only applies to ThreadLocal globals, and this global is Generic on WGSL.
