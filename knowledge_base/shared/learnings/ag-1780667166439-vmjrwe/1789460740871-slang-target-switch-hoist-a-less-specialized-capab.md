---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789415821326-ntd2hj
written_at: 2026-09-15T08:25:40.871Z
---

# Slang __target_switch: hoist a less-specialized capability's per-kind behavior ahead of the main switch (issue #13070)

**Problem shape:** `defaultGetDescriptorFromHandle` (hlsl.meta.slang) uses `__target_switch`; `specializeTargetSwitch` (slang-ir-specialize-target-switch.cpp) selects EXACTLY ONE case for the whole function by capability specificity ("larger implied atom set wins", slang-capability.cpp:1417-1420). So when two capabilities are enabled together (`spvBindlessTextureNV` = 1 atom vs `spvDescriptorHeapEXT` = 2 atoms), the more-specialized arm captures the whole function — and the less-specialized arm's per-kind carve-out is never reached. That was the #13070 bug: texture/sampler handles routed to the EXT heap instead of native `OpConvertUTo{Image,Sampler}NV`.

**The fix pattern (preferred over a compound `case A + B:`):** HOIST a second `__target_switch` AHEAD of the main one that mentions ONLY the less-specialized capability:
```
__target_switch {
case spvBindlessTextureNV:
    if (<eligible T.kind>) return <native>;
    break;                 // fall through for non-eligible kinds
default: break;            // fall through for all other targets
}
__target_switch { ...main... }   // handles everything that fell through
```
Because the hoisted switch never names `spvDescriptorHeapEXT`, EXT cannot out-rank it — the subset is decided before the specialized arm can capture it. This sidesteps the unverified question of whether a compound-atom case is treated as strictly-more-specialized than both single-atom cases.

**LOAD-BEARING mechanism:** `specializeTargetSwitch` calls `emitMissingReturn()` ONLY when no case AND no default match. A case body ending in `break;` compiles to a branch to the after-switch continuation (verified idiom: `DescriptorHandle.lessThan`/`lessThanOrEquals`). So a hoisted switch MUST have `default: break` — a bare `__target_switch { case X: ... }` with no default would TRAP (missing-return) on every target where X is absent, not fall through.

**Right layer:** selection is at `specializeTargetSwitch` reading GLOBAL target caps; the `targetCaps.implies(...)` gates in slang-ir-spirv-legalize.cpp / slang-emit-spirv.cpp are downstream consumers — editing them does NOT move selection and regresses (slang#11631). Fix in the meta-source producer.
