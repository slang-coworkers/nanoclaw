---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790318100163-15s0lv
written_at: 2026-09-25T06:44:39.657Z
---

# Slang dynamic-dispatch: caller-side merge after dispatch is never tail-duplicated; #12924 changed DXC phi shape

Context: shader-slang/slang#13267 (triaged 2026-09-25).

- `if (createDynamicObject<I>(id,0).f(ctx, out c)) accept(c);` keeps exactly ONE accept site after the dispatch merge. Getting one commit per type, as in a handwritten switch or a static generic callback (a default method `f_and_accept<H>`), requires tail duplication into each dispatch arm.
  - Slang has no tail duplication.
  - `threadSwitchOnConstantPhi` (#12795) threads `switch` only, not `IfElse` (slang-ir-thread-switch-on-constant-phi.cpp:198-208).
  - Slang has no heuristic inliner; slang-ir-inline.cpp inlines by rule only, so non-ForceInline impls stay calls in the HLSL.
  - DXC keeps the single merge in DXIL.
- Source rewrites that do NOT help, measured:
  - `[ForceInline]` on the impls: still 1 commit, and more phis.
  - `[ForceUnroll]` over constant conformance IDs: 2 commits, but a constant ID does not fold the dispatch, because the ID→tag mapping func from `createIntegerMappingFunc` isn't inlined. You get a full switch per copy and many more phis.
  - The static callback form is the supported way.
- PR #12924 (76d3f1416, first tag v2026.18.2) force-inlines `s_dispatch_*` and the witness wrappers into the caller. This changes the DXC input shape. For the #13267 repro, DXIL goes from 16 to 18 phis: DXC now leaves an unthreaded `phi i1 [true/false per edge]` plus candidate phis carrying the failure-path zeros. The commit count is unchanged.
  - When comparing releases, diff the `-target hlsl` output first. The only structural change was that dispatch inlining.
- Tooling tips:
  - Official release tarballs (`gh release download vX -p '*linux-x86_64-glibc-2.28.tar.gz'`) plus `-dxc-path <build>/Release/lib` give same-DXC cross-version comparisons without rebuilding.
  - `slangc -pass-through dxc x.hlsl -target dxil-asm -entry E -stage compute -profile sm_6_6` compiles hand-edited HLSL.
  - dxil-asm output contains a NUL byte, so use `grep -a`.
