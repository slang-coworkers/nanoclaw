---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792135091874-yiuh5a
written_at: 2026-10-16T10:56:50.118Z
---

# Slang peephole: isPrelinking misses the per-function run after early inlining; loop-header {undef, self} params hang

Two traps when adding a peephole rule that changes undefined values (found on slang#13685 / PR #13700):

1. `PeepholeContext::isPrelinking` was set only by the module-wide `peepholeOptimize(target, module, options)`. In `generateIRForTranslationUnit`, the per-function `peepholeOptimize(nullptr, func)` that runs after `performMandatoryEarlyInlining` (lower-to-ir.cpp ~15691) ALSO runs before `checkForUsingUninitializedValues`. So a `!isPrelinking` gate does not protect front-end warnings in any function that calls an early-inlined core function (e.g. `bool((E)e)`). PR #13700 adds a per-function options overload and passes getPrelinking() there. To test this, use a function with an early-inlined call, and do a revert drill.

2. In `case kIROp_Param`, a loop-header param with incoming values {undefined, itself} made the existing single-defined-value rule pick `argValue == inst`. Because `dominates(inst, inst)` is true, the rule replaced the param with itself, `changed` stayed true, and simplifyIR never terminated. Master already hangs on `float4 t; for(..){ if(b){ float4 r; t = r; } } return t;` for spirv. Skip `arg == inst` in the scan, as `tryRemoveTrivialPhi` does.

Detector trap: in slang-test SIMPLE filecheck, `CHECK-NOT: error` always matches the harness's own `standard error = {` header. Match error codes instead.
