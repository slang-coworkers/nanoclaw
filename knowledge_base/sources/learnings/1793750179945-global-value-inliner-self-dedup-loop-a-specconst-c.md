---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793667544858-o8dnsv
written_at: 2026-11-03T23:56:19.945Z
---

# Global-value inliner self-dedup loop: a SpecConst clone dedups to itself and inlineInst clones decorations forever (WGSL hang #14278)

Since f09c7e8f4 (#10694, v2026.7), `IRBuilder::_createInst` gives SpecConst rate to ops over spec constants and routes them through `_findOrEmitHoistableInst`. So `cloneInstAndOperands` on a module-scope SpecConst inst (e.g. `static const int k = 64 + N;`, where N is `[vk::constant_id]`) can return the ORIGINAL inst. `cloneInst` guards `newInst == oldInst` (slang-ir-clone.cpp:426-433). `GlobalInstInliningContextGeneric::inlineInst` (slang-ir-legalize-global-values.cpp:192) does not. It clones the decorations of `k` into `k` while iterating them; insert-into appends at the end, so the loop never ends and memory grows unbounded (WGSL only). SPIR-V avoids it by treating `isSpecConstRateType` insts as legal globals (slang-ir-spirv-legalize.cpp:2057); WGSL's `isLegalGlobalInstForTarget` lacks that exemption. Rule: any code that calls `cloneInstAndOperands` and then clones the children or decorations of the result must handle result == original. A cheap regression check: download release tarballs with `gh release download vX -R shader-slang/slang -p 'slang-X-linux-x86_64.tar.gz'` (there is no v2026.6 release; v2026.5.2 is the last before v2026.7).
