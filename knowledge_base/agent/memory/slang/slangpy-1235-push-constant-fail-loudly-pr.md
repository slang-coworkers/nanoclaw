---
type: chain
title: slangpy#1235 — fail loudly on Vulkan push-constant globals (SlangPy side of #1232)
description: SlangPy PR for slangpy#1232 approach A. Head 52e815d6, CI green, 2 internal review rounds (APPROVE_WITH_NITS), APPROVED by ccummingsNV 10-19, ready 10-19, behind main; awaits merge.
resource: https://github.com/shader-slang/slangpy/pull/1235
---

# slangpy#1235 — raise `SlangPyError` for a Vulkan push-constant global

Parent chain: [[slangpy-1232-vulkan-module-push-constant.md]]. Branch `fix/issue-1232`, `Fixes #1232`.

## What the check does (head `52e815d6`, 10 files +460/−1)
- Functional API on Vulkan raises when the module has a push-constant global.
- Raw `Function.dispatch` raises only when the kernel has EP uniforms or the module has a global
  ParameterBlock. The first draft over-blocked: the triager's `glob_pc` kernel (global resource + push
  constant, no EP uniforms) is correct on main, so it was narrowed (head `ceb9a9a`).
- R1 gaps fixed: a push constant in an `import`ed module is caught by also checking the linked program
  (G1); a ParameterBlock EP argument that wrote nothing now raises (G2).
- Disclosed, conservative: a global PB plus a buffer kernel (`pb_data`, OK on main) is now blocked — it
  only breaks when the push constant sits alone in set 0 (#12349), and SlangPy deliberately does not
  re-derive rhi set numbering. An imported-module push constant fires VUID 00292 once before the raise
  (sgl `link_program` builds the layout); nothing is dispatched.

## Verification
- New tests 12/12 vk+cuda; revert drill: 6/6 Vulkan cases fail without the fix.
- Full suite 3693 pass, 50 fail — all git-lfs, failing on baseline too.
- CI 14 check-runs + 2 statuses success. Explanation cmt 6220677658; issue status cmt 6221146751.

## Review
- slangpy-reviewer R1 REQUEST_CHANGES (G1, G2) → R2 APPROVE_WITH_NITS: N1 applied; N2 (a user global
  named `call_data` is skipped) declined as low priority. Internal reviews not posted to GitHub.
- Reviewer side finding: raw dispatch of a global `ParameterBlock` + EP uniform writes nothing on Vulkan
  (CUDA correct) — exactly the slang#12349 shape, fixed by slang-rhi#810; added to the #810 operator
  decision as evidence, not a new issue. Repro: slangpy-reviewer FS `/workspace/agent/reports/review-1235/probe3`.
- **10-19 15:28Z APPROVED by ccummingsNV** ("LGTM"); 10-19 17:25Z jkwak-work marked it ready.
  `mergeable_state=behind` (2 commits: #1236 texture revert, #1237 Slang 2026.20 + rhi bump, which per the
  fixer does not touch push-constant layout). Whether an update-branch dismisses the approval is unknown:
  branch-protection reads return 403 to us.
- 10-20 22:33Z jkwak-work (MEMBER) cmt 6303273966 on #1232: "A related fix is merged in slang repo: #13724. I am wondering if it helps to simplify the proposed error handing in slangpy side: #1235". Routed to the owner
  slangpy-fixer session `7vr9a3` (pinned, canonical thread) to answer on #1232. Facts I gave it: v2026.20 (10-17) predates the 22:20Z merge; E39033 only catches EPs that *statically use* 2 blocks, so the
  `unused` repro (the rhi#915 offset bug) and the PB path (#12349/#810) look out of its reach. These are for the fixer to measure, not settled. No code push before jkwak-work agrees (#1235 already approved).
- 10-20 22:48Z reporter cmt 6303508603 answered jkwak-work with slangc before/after measurements: E39033 catches only the EP-uniform + `read` shape; `unused` (rhi#915) and the PB path (#12349/#810) still compile and return wrong values. Their conclusion: #1235 can't be simplified until #915 and #12349 are fixed. This matches Main's routing note. Told the fixer to confirm briefly from the SlangPy side (or disagree with evidence), not repost the table.
- 10-20 22:55Z the fixer replied to jkwak-work on #1232, cmt **6303626365** (verified, short, no repost). The end-to-end run (SlangPy + Slang 69ad6c1, L40S Vulkan, #1235's check off) agrees with
  the reporter: EP-uniform + `read` → E39033 (SlangPy raises RuntimeError at dispatch); `unused` still wrong (`[0.851,0,0,0]`); user-PB raw dispatch writes nothing; resource-only correct.
  The #1235 tests pass on 69ad6c1 (84 passed, 8 skipped). Verdict: no simplification now; a follow-up after rhi#915 and #12349 are fixed and SlangPy picks them up, rerunning the matrix. No code pushed.
  Artifacts on the fixer FS: `repro-1232/e39033_matrix.py`, the logs, `slang-69ad6c1`, `wt-slangpy-1232-e39033`. #1235 is still open at `52e815d6`, waiting on a maintainer merge.
- **10-22 16:35Z jkwak-work (MEMBER) reassigned #1232 to kaizhangNV** (cmt 6345963399, **edited 16:36:18Z**; the webhook payload lacked the 2nd paragraph). Live text: "I am assigning to @kaizhangNV
  because this is related to, or block by, the issue assigned to him: slang#12349. Note that the proposed PR for this issue is already approved. But I think it will be a good idea to resolve
  the slang and slang-rhi side problems before put the bandaid/error-handling on slangpy." ⇒ **#1235 is HELD by maintainer direction** (still approved, open, behind main; no merge expected).
  The comment @-mentions a human, so there is no bot post. The critical path is now upstream: #12349 → **slang-rhi#810** (our bot draft, kaizhangNV) and the rhi#915 offset (jkwak-work direction).
  Told slangpy-fixer to hold #1235 as-is (no rebase, no nudges); re-raised #810 to the operator as now blocking.
