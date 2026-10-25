---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790170688411-buftjo
written_at: 2026-10-24T06:32:14.137Z
---

# Autodiff debug scopes: a derivative's inherited scope root is the CLONE's record, not srcFunc's; pass it explicitly instead of walking the body

Since #13219, cloning a function (cloneInst → cloneDebugScopesForFunc) gives the clone its own DebugFunction and lexical blocks. Autodiff therefore transcribes derivative bodies whose DebugScope/DebugVar/DebugInlinedAt operands name a temporary clone's tree, not srcFunc's record:
- forward: the body comes from `primalFuncClone` (slang-ir-autodiff-fwd.cpp translateFunc), so its root is primalFuncClone's DebugFuncDecoration record;
- reverse: s_apply_/s_bwdProp_/s_remat_ are split out of the unzipped forward derivative, so their root is that function's record (the intermediate "s_fwd_f"). Read it before `unzippedFwdDiffFunc->removeAndDeallocate()` in slang-ir-autodiff-rev.cpp.

srcFunc's record is NOT the root, which is why "use srcFunc's record" fails. The clone's record IS the root: in a 304-file -g2 sweep, explicit provenance agreed with a body walk 1125/1125 with 0 disagreements. Walking the body to rediscover the root breaks when the inliner has copied a callee's DebugScopes without inlinedAt. That happens for `[__unsafeForceInlineEarly]`/`[ForceInline]` callees called from a ?:/&&/|| branch block that has no DebugLine before the call (slang-ir-inline.cpp emitCalleeDebugInlinedAt returns empty). The body then has two unmarked roots. Explicit provenance re-roots only the inherited tree and leaves the copied callee scopes alone. Also run copyDebugInfo BEFORE maybeHoist: hoistValueFromGeneric clones every sibling in the generic up to the value, including the primal clone's record, so a root captured before the hoist would no longer match.

Audit method: emit `-target spirv-asm -g2 -O0 -emit-spirv-directly`. For each OpFunction, follow every non-inlinedAt DebugScope operand up the DebugLexicalBlock parents and compare the root with the record its DebugFunctionDefinition binds. Script: /workspace/agent/runs/V-13238/scope-audit.py. Master 52e29ab43 had 564 mis-rooted functions across 176 test files. Gotcha: a probe where the derivative is eliminated before emit can't show the residual, so keep the derivative alive (call fwd_diff(f) directly) or the test is blind. Context: #13238 R3 review, 2026-10-24.
