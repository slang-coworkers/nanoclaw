---
type: chain
title: "slang#13169 — bwd_diff hang on runtime-bound loop (from slangpy#1167)"
description: "CLOSED 2026-10-09 by saipraveenb25: fixed on master by #13234 (dup of #13226). slangpy#1167 open; CUDA check passed 10-16; test PR slangpy#1225 (draft) is RED on D3D12 with E56019, a Slang 2026.20 regression; waiting on the operator (ceiling + approach)."
---

# slang#13169: bwd_diff runtime-bound loop hang

- **Terminal:** saipraveenb25 closed it as completed on 2026-10-09 20:43Z with "Looks like it's been fixed."
  (comment 6088934503). That confirms the bot verdict in comment 5881003685: fixed on master by #13234, a duplicate
  of #13226. It was verified without a GPU: the compile A/B no longer hangs and the CPU gradients total 320.
- **Routed 10-09:** slang-triager, session `sess-1789716151214-yz6n7y`, posted the [Resolution] as comment 6089027709 (20:50Z). The triager chain is closed. slangpy-fixer,
  session `sess-1789719798342-ukgccz`, owns closing slangpy#1167. The CUDA `runtime` variant must print
  `bwds ok grad_sum=320` on a build that contains #13234, so the close needs a GPU.
- **GPU check done 10-16 07:49Z:** the 10-09 "no GPU" was the host passthrough bug (fixed 10-16). slangpy-fixer re-ran the CUDA `runtime` variant on the L40S and it passed (slangpy#1167 cmt 6210717821). A maintainer closes #1167.
- **slangpy#1225 / #1227 (10-20 re-check):** #1225 (regression test, owner fixer session `sess-1787042942592-fhnz2d`
  via pr-mapping) is still a draft. Head `5a19d513`, CI 38887675966 green since 10-16 (`vulkan-*` XFAIL against #1227),
  no human review, no fixer [Report] or round-2 reviewer verdict. Fixer nudged (msg 51). #1227 was triaged silently on
  10-19 (autodiff label, Q1-2027 milestone, assigned to saipraveenb25). The CI GPU name is still unknown, because the
  xfail hides the assertion message. The decision on CI-GPU repro and slang escalation went to the dashboard (msg 53).
- **Fixer [Report] 10-20 08:12Z (verified):** the round-2 review request had never been sent. The fixer waited for a
  CI-green webhook, which does not exist (`check_suite` success only releases parked approver PRs; it is not routed to
  the fixer). The request is now with slangpy-reviewer (`sess-1792141451732-lkncyn`, inbound 08:12:45Z). Draft, head
  `5a19d513`, 17/17 checks green. Re-check `recheck-slangpy-1225-r2-d743` (10-20 14:00Z). The fixer offered a separate
  `print(adapter_name)` so CI logs the #1227 GPU; that belongs with the #1227 operator decision, not round 2.
- **Round 2 APPROVE_WITH_NITS 10-20 08:25Z** (0 bugs; reviewer said apply the nits without another round). I chose
  option (a): put `adapter_name` in the xfail reason (this reverses my 08:20 "not here", whose only reason was a
  review restart that no longer applies) and merge `main` `e7bb224` (Slang 2026.20) with a merge commit, with no
  force-push. The repo is squash-only, so the merge commit doesn't survive. Also trim the body to ≤1000 characters. Re-check task
  updated to match.
- **Pushed 08:34Z, head `4e90d26e`** (a fast-forward, +4/−0; the body is 998 characters; CI 39394324237 running). The fixer's re-check
  `recheck-slangpy-1225-ci-242f` posts the 5-bullet, adds the GPU name to #1227, and sends the `[Fix Report]`.
  ⚠️ **Two Orchestrator sessions drove this chain at once:** the `gh-issue-…slangpy-1167` session
  (`sess-1789707826197-l3jhpp`) told the fixer at 08:26 to rebase and **mark ready** after green, and the dashboard was told
  the same. That breaks [drafts-only](../imported/feedback_drafts_only_guardrail.md). At 08:40 I withdrew the
  ready step (fixer msg 93), corrected the dashboard (msg 95), asked the operator whether to mark it ready or keep it a draft, and rewrote
  `rechase-slangpy-1225-rea-3520` (10-21 12:00Z) so it never marks the PR ready.
- **CI RED 08:50Z on `4e90d26e` (run 39394324237):** only the 3 `d3d12-*` cases fail, on both Windows msvc jobs, with
  `error[E56019]: target cannot represent an opaque value in mutable local storage`. E56019 is new in Slang v2026.20
  (slang#13116 `c538debef6`, tangent-vector, merged 10-14); D3D12 passed on 2026.19 at `5a19d513`, so this is a 2026.20
  regression caught by the new test. No slang/slangpy issue existed. **#1227 GPU now known: NVIDIA GeForce RTX 5090** (CI,
  Linux and Windows); the L40S passes. The fixer is STOPPED at its ceiling ($83.92/$76.74; group p95 $59) and holding pushes
  (msg 113). The operator was asked (msg 111) for: (1) a ceiling continue, (2) an approach. I recommended (a): a slang issue plus a D3D12 xfail;
  the alternatives are (b) revert to 2026.19 or (c) leave it red. `recheck-slangpy-1225-r2-d743` (14:00Z) re-asks or forwards the answer.
- **Fixer [Report] 10-20 10:32Z (task `recheck-slangpy-1225-ci-242f`, fixer session `sess-1792485259274-opbm33`):** a minimal
  pure-Slang repro is at fixer `repro-1167/d3d12/min/d.slang` + NOTES.md. It compiles on 2026.19 and fails E56019 on 2026.20 and 2026.20-1;
  DXC 1.9 accepts the HLSL that 2026.20 emits. The fixer's root cause: the autodiff loop phi merges the real `RWByteAddressBuffer` with a
  `defaultConstruct`, and `eliminatePhis` turns it into a var. It thinks slang draft #13700 (#13685, all-undefined phis) does not
  cover this (not tested). I verified `c538debef6` is in v2026.20 and not in v2026.19, and that no slang issue for this shape exists.
  The status comment and the #1227 RTX 5090 comment are posted. The operator had not answered the 08:55Z ask, so I told the fixer to hold
  (no issue, no xfail, no rerun) and re-asked on the dashboard at 10:3xZ (msg 27). The fixer is still stopped at $77.26/$76.74.
  `recheck-slangpy-1225-r2-d743` (14:00Z) forwards the answer or asks again.
  That re-check ran at 14:00Z: no operator answer, head still `4e90d26e`, fixer still stopped at $77.26/$76.74, so I re-asked
  decisions (1)+(2) on the dashboard a 3rd time (msg id 7). No new timer is set; the next `/supervise-issues` tick owns the chase.
- **Cancelled:** re-chase `rechase-slang-13169-1330-0772`, which bundled this close with #13301. #13301 is still
  saipraveenb25 answered on 10-09 at 21:10Z with a question instead of an (a)/(b) pick: does removing `[Differentiable]`
  from functions with a custom derivative work? He says that is the intended usage, and the double-conformance bug
  should still be fixed. slang-fixer was dispatched to test it and draft a reply (pinned to `sess-1789716207340-dwbdoz`;
  fixer's gh works again). Fixer replied on 10-09 at 21:56Z: the workaround works only partly, and it recommended the guard PR.
  On 10-18 at 02:45Z saipraveenb25 said: "open a PR with the header fix". That closes #13301 and slangpy#1204; the conditional
  `__func_extension` case is deferred. Dispatched to the same fixer session. Re-chase: `rechase-slang-13301-huma-91bf` (10-19 09:00Z).
- **Spin-offs:** the #9808 autodiff cluster, recorded in [13332-second-order-nodiff-scope.md](13332-second-order-nodiff-scope.md).
