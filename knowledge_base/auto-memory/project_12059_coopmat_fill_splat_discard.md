---
name: project_12059_coopmat_fill_splat_discard
description: "#12059 HLSL CoopMat.fill/clear discard Matrix::Splat return — triaged+parked, jkwak self-filing"
metadata: 
  node_type: memory
  type: project
  originSessionId: cc98431d-7934-474e-80fc-973cdc225391
---

shader-slang/slang#12059 — [HLSL] CoopMat.fill/clear discard Matrix::Splat return value. jkwak-work self-filed (`Dev Opened`, NOT self-assigned). Triaged 2026-07-10, repro REPRODUCED at HEAD 01adc68f3. Severity high / P2, component target-emit HLSL + core-module hlsl.meta.slang.

**Root cause:** On HLSL/DXIL SM6.10, `CoopMat.fill(t)` HLSL case is `__intrinsic_asm ".Splat"` on a `void [mutating]` method → emits bare `C_0.Splat(0.0f);` with return discarded; `Matrix::Splat(T)` is a *static value-returning* op (hlsl-specs proposal 0035), so dest stays uninitialized → PSO-creation access violation. HLSL is the ONLY broken target — spirv/cuda/metal cases correctly capture the value. `clear()`→`fill(T(0))` and scalar ctors `CoopMat(T)`→`fill` inherit it. Introduced by PR #10711.

**Approach A (recommended, fixer-ready):** in hlsl.meta.slang add `internal static This __hlslSplat(T t) { __intrinsic_asm "$TR::Splat($0)"; }` (mirrors `__hlslLoadBAB` at :28285), change HLSL case of `fill` (:28226-27) to `this = __hlslSplat(t);`. Emits `C_0 = ...::Splat(0.0f);`. Local, no IR/C++ change. Regression test = re-enable DXIL compile in `tests/cooperative-matrix/fill.slang` (DISABLE_TEST at :6, needs DXC in CI) + filecheck `-target hlsl` for `= ...Splat(`. Approach B (prelude wrapper + kIROp_CoopMatFill) rejected as overkill; C (emitter special-case) rejected (fixes consumer not producer).

**State (07-11, latest):** FIXER DISPATCHED, AWAITING PR. Triager (msg 16) verified bot-mention + no pre-existing PR/branch, dispatched slang-fixer on canonical thread with full spec: implement jkwak's tested inline `__intrinsic_asm "$0 = $0.Splat($1)"` (NOT our `__hlslSplat` helper), branch fix/issue-12059, DRAFT, `Fixes #12059`, HLSL FileCheck regression on fill.slang `-DBAB` (RHS-must-be-`.Splat(...)` + clear() + scalar-ctor, DXIL stays disabled), report_pr_created on open, drafts-only (no ready/merge). Triager will forward PR# to Main on this thread once fixer reports. **No PR number yet — do not fabricate one.** Draft-held observability: when PR opens, owning tier posts 5-bullet issue comment answering jkwak's request (draft-held ≠ substitute for issue comment).

**History (07-10):** RE-ENGAGED — jkwak 4940736154 "please create a PR" (trigger b). Authorized THROUGH triager. Implement his inline form, NOT our `__hlslSplat` helper.

**History:** HELD for jkwak self-fix (before the PR request). Triager POSTED verified verdict to GitHub (comment 4940262185, P2). Then 07-10 jkwak posted his own triage comment (4940278937): confirmed, upgraded to **P1** (silent miscompile of supported API → driver AV at PSO creation), not-dup of #11613, root cause matches ours. He gave a **tested** fix he prefers over our Approach A: inline `__intrinsic_asm "$0 = $0.Splat($1)"` (emits `(C_0)=(C_0).Splat((0.0f));`, matches `CoopVec.fill`) — simpler than the `__hlslSplat` helper. Regression: HLSL FileCheck on fill.slang with `-DBAB` asserting assignment RHS `.Splat(...)` + a clear()/scalar-ctor case. He did NOT open a PR / self-assign / ask the bot — classic self-fix ([[project_11806_cmake_options_maintainer_selffix]], [[project_11732_groupshared_vuid_dawn_tint]], [[project_12035_overload_diag_reasons]]). **NO fixer dispatch** (his tested fix → dup-PR risk); drafts-only ([[feedback_drafts_only_guardrail]]); no new GitHub comment (he's last commenter, supersedes+agrees). Re-engage ONLY on his PR appearing OR an explicit "please implement". Triage memo: inbox/a2a-1783725149176-cwmx9s/triage-12059.md.
