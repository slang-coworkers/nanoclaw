---
type: chain
title: slang#13964 — HLSL default-inout receiver rejects immutable receivers
description: Regression from #13615; triage resolved, bot draft PR #13966 (call-site-dialect design) design settled by tangent-vector; parked on operator un-draft sign-off
---

# slang#13964 — HLSL methods no longer callable on immutable receivers

- **Filed** 2026-10-27 by tangent-vector (MEMBER, also author of the regressing PR #13615, which fixed #13073).
  Repro: `helper.help()` on a `cbuffer` member now raises E30050, because #13615 made unannotated HLSL
  methods take a `BorrowInOut` receiver. DXC `-HV 2021` accepts it; `-HV 202x` and Clang reject it.
- **Triage** (slang-triager `sess-1793136956389-4i9ub9`), 21:50Z: regression, P1. Issue comment
  6454475228, labels `reproduced` and `regression`, Type Bug. The same root cause breaks interface conformance
  with an `in` receiver (E38105). The HLSL language-version mechanism is logged as a separate long-term item.
- **Fix:** slang-fixer `sess-1793137690090-eygrm7` opened **draft PR #13966** (`fix/issue-13964`, head
  `4fa4431`, Approach B: `ThisParamInfoAttribute::acceptsImmutableReceiverCopy`, which passes a copy with no
  write-back). Review requested from tangent-vector; the pr-mapping is in place. I verified all of this on GitHub at 23:17Z.
- 10-27 23:16Z the PR was parked on two questions for tangent-vector: (a) should a write to a discarded `this` copy
  warn, and (b) should default methods satisfy `const` requirements?
- **10-28 00:20Z, tangent-vector rejected Approach B** ([comment](https://github.com/shader-slang/slang/pull/13966#issuecomment-6457232749),
  verified). Whether `x.f()` is accepted, where `x` is immutable and `f` has an effective `inout` receiver, must depend
  on the dialect of the **call site** (accept it when checking HLSL), not on the language `f` was written in. Approach B put
  a bit on the callee's `ThisParamInfoAttribute`, which was the wrong layer. Peer review R1 had also returned
  REQUEST_CHANGES. The fixer acknowledged on the PR and is reworking it; the head was still `4fa4431` at 00:25Z.
  The triager edited issue status comment 6455952706 in place.
- **10-28 02:58Z, triage RESOLVED (fixed in draft).** Head `93a1f017d` (verified: draft, 13 files, +650/−6,
  `pr: non-breaking`). Overload resolution stores the decision on the call as `AppExprBase::passesImmutableReceiverCopy`;
  lowering reads it from there. HLSL call sites pass a fresh copy with no write-back. There is no new serialized state and
  no module-version bump, so the earlier module-v38 collision with #13953/#13872/#13564 no longer applies. Peer review
  R2 must-fix (overloaded implicit-`this` calls were copied without checker approval) is fixed and tested. Full Debug suite
  11190/11193 (fp8-cuda failures also on master).
- **10-28 06:38Z, tangent-vector answered** ([comment](https://github.com/shader-slang/slang/pull/13966#issuecomment-6462478732),
  verified). The callee gets a temporary copy and nothing is written back; HLSL downgrades E30050 to a warning (not
  silent); E30068 for `in` parameters stays. The fixer added warning E30134 `mutating-method-on-immutable-value-warning`.
  Head `e785e0710` (verified: draft, 14 files, +683/−6). The warning delta had codex review only, because the peer-round
  cap was reached.
- **PARKED on:** operator sign-off to move the PR from draft to ready (asked on the dashboard 10-28), then maintainer
  review. When the PR is made ready, check `paused` before routing pr_ready_for_review (approvers are paused).
- **10-30 16:0xZ, re-chase r1:** no operator answer on the dashboard (I scanned Main session `81yz2f` and the dashboard
  session rows back to 10-27). GitHub, checked live: still a draft at `e785e0710`, `BEHIND` master, CI 5 pass / 53 skipped,
  0 reviews, and no maintainer comment since 10-28 06:38Z (the fixer answered it at 06:40Z). I sent the **2nd un-draft ask**
  to `orchestrator-dashboard` on the chain thread (msg 19). On a yes, the fixer **merges** master (no rebase) before `gh pr ready`.
- **Timer:** one-shot `rechase-slang-13964-r2`, 2026-11-02 16:00Z (task-hygiene allowed r2 of 3; it carries the r1 decision
  table, and its no-answer branch is the 3rd ask).
