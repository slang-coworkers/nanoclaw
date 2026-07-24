---
name: project-12197-rayquery-byvalue-return-nrvo
description: "shader-slang/slang#12197 RayQuery by-value return silent SPIR-V miscompile → draft PR"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3af70ce6-0b9a-444b-a8c4-8114b1725979
---

# #12197 — RayQuery by-value return silent miscompile on SPIR-V

**Bug (P1/high, verified):** A plain function returning `RayQuery<...>` by value silently miscompiles on SPIR-V — `OpRayQueryInitializeKHR` targets one query var, the `Proceed()` loop runs on a different, never-initialized one → runtime UB → GPU device-loss on Vulkan/NVIDIA (Xid 109). Works on DXIL→Metal. No diagnostic fires. Reporter `mediawaffle` (external). Distinct from #10826 (closed, "open a new issue after 2026.6" — this IS that follow-up) / #10774 / #10818 (interface-conformance diag only).

**Root cause:** return-dest transform DOES fire (falsified a subagent skip-hypothesis via disasm); defect is inside the callee — it inits a fresh local then value-copies the whole opaque handle into the dest via `OpLoad`+`OpStore`, a no-op for a non-copyable `RayQuery`/`HitObject`. General opaque-copy family; a bare `RayQuery b = a;` miscompiles identically.

**Fix — draft PR #12200** (branch `fix/issue-12197`, head fcfcc00b7a, base master, `pr: non-breaking`, `Closes #12197`). Approach A/NRVO: alias the named-return local to the return-dest param so the handle builds in place — mirrors the verified-correct `out`-param codegen. New shared `isNonCopyableOpaqueType` (narrower than `[__NonCopyableType]` — excludes bit-copyable tagged structs). Guards: defer / throwing functions / aliasing-by-ref params (all 3 added after codex CODE_REVIEW caught 2 real soundness regressions across 9 rounds; gh-10774 test was a false-green). 4 files +~230/−11, 5 tests, 2113 tests green.

**Scope — deliberately narrow.** Residual opaque-copy shapes (`b=a`, `box.q=makeQuery()`, NRVO-bailout paths) STAY silently miscompiled, NOT diagnosed — flagged verbatim in PR body as "Known limitation (scoped, not a regression)". Approach B (copy-site diagnostic, reporter option 2) DEFERRED as PR "Open question for maintainers": warning(non-breaking, cf #10818) vs error(breaking) is a policy call + must not false-fire on out/inout arg passing (same OpLoad/OpStore).

**State (2026-07-23):** ONE canonical issue comment `5054900293` (triager consolidated — folded fix status + Known-limitation into it, deleted the fixer's separate 5056679566 dup; issue shows exactly 1 bot comment). `report_pr_created` confirmed → #12200 maps to slang-fixer session. Review IN PROGRESS (slang-reviewer Devin/build/clarity, peer-wired to fixer). Reviewers `kaizhangNV`/`pdeayton-nv` = CODEOWNERS auto-assign, not bot-set. **Ready-flip/merge OPERATOR-gated.** Await reviewer verdict on canonical thread `gh-issue-shader-slang/slang-12197`.

**Pre-ready-flip gate — RESOLVED:** scratch `pr-body-12197.md` committed at #12200 root was removed; head now `e7dc2baee8`, only 4 source files + 5 tests remain, still OPEN draft + mergeable (triager-verified). Issue-comment EDIT is 403 for the fixer's token but works for the triager's — route consolidations/edits through triager.

Related: [[project_12185_bindless_texture_nv_desc_handle_nonimage]] (sibling DescHandle abort). Sibling non-copyable-copy family (out of scope here): #8002 (__constref ParameterBlock), #7455 (NonCopyable Accessor ICE).
