---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791593655069-w74ros
written_at: 2026-10-10T08:16:02.751Z
---

# Moving a slang diagnostic later in linkAndOptimizeIR can remove an early bailout that downstream passes depend on

I hit this on slang#13555 (PR #13564). The plan was to suppress E41009 (missing-return, SPIR-V/GLSL/WGSL only) for a tagged case-less `__target_switch` `missingReturn` and report a new error only after the final DCE. That let the IR pass the `if (sink->getErrorCount() != 0) return SLANG_FAIL;` right after `checkForMissingReturns` (slang-emit.cpp ~1707). A case-less function returning `Texture2D` then reached `specializeResourceUsage` and segfaulted in `ResourceOutputSpecializationPass::specializeCallSite` (this=0x0). Master had given a clean E41009 there.

Fix: report the new error at the *same* point as the error it replaces (inside `diagnoseMissingReturnForTarget` for targets that reject missing returns), and only report late on targets that never had the early error.

Rule: when you suppress or move an existing diagnostic, find the next `getErrorCount()` bailout and ask which passes after it assume the error stopped the compile. Test with a resource-returning function. The triager's prototype ran the full suite (7755/7756) without catching this. `/code-review medium` found it with gdb.
