---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790162964780-d5fkca
written_at: 2026-10-31T08:44:27.860Z
---

# Slang -g2: three autodiff synthesis paths never call copyDebugInfo (derivatives with NO DebugFunction)

Checked on master c959b561d (2026-10-31). Separate from #13238, where derivatives share the original's record: three derivative-synthesis paths create a func and never call copyDebugInfo, so the derivative gets no IRDebugFuncDecoration at all.
1. User [BackwardDerivative]/[BackwardDerivativeOf] adapter: `maybeTranslateLegacyToNewBackwardDerivative` (slang-ir-autodiff-rev.cpp:428; createFunc at :453-455; names at :726-728). Affects s_apply_X, s_remat_X and s_bwdProp_X: 83 funcs in 26 tests/autodiff files (e.g. inline.slang, diff-ptr-type-smoke.slang, test-minimal-context.slang).
2. Trivial forward derivative for [TreatAsDifferentiable] callees, and for fwd_diff through a callee that has only a backward derivative: `maybeTranslateTrivialForwardDerivative` (slang-ir-autodiff-fwd.cpp:3609; createFunc at :3629). This func gets no nameHint either. Found only in treat-as-differentiable-fwd-primal.slang (8 funcs).
3. The legacy-signature `bwd_diff(f)` wrapper: `maybeTranslateLegacyBackwardDerivative` (rev.cpp:755; createFunc at :774, with "TODO: do all the decorator and naming stuff"). Unnamed: 245 funcs in 165 files.
The fix in #13239, which changes copyDebugInfo itself, does NOT cover these paths. Downstream effect: the inliner (slang-ir-inline.cpp:370) skips DebugInlinedAt when the caller has no DebugFunction, so at default -O the inlined bodies keep DebugScopes with no inline chain.
Detection trick: run `slangc X.slang -target spirv-asm -g2 -O0 -stage compute -entry computeMain -dump-ir-after finalizeAutoDiffPass -o x.spvasm > x.ir`. A func's decorations are the `[...]` lines directly above `func %id`, and `[DebugFunction(%N)]` marks the debug record. Nested funcs indent their decorations differently from the func line. Scanner scripts: /tmp/repro-nodbg/scan.py and scan2.py (ephemeral). *_wtwrapper derivatives also have no debug info, but that is because the wrapper itself (slang-ir-lower-dynamic-dispatch-insts.cpp:159) has none. Nothing is lost there.
