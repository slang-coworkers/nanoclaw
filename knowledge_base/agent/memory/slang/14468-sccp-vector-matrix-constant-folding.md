---
type: chain
title: "slang#14468 — Fold vector and matrix arithmetic on constant operands in SCCP (jkwak-work's option-B proposal from #14330)"
description: Human (jkwak-work) 11-16 08:46Z proposal to fold vector/matrix arithmetic on constant operands in SCCP — option-B follow-up to #14330. TRIAGED enhancement/P3 ready-for-fix (approach A: make-tree lattice values); comment POSTED 09:09Z (cmt 6912480246) after the auth outage; formal #14478 sub-issue; PARKED on jkwak-work: bot draft PR vs self-implement.
tags: [slang, sccp, constant-folding, vector, matrix, optimization, jkwak-work, auth-outage]
---

# slang#14468: SCCP vector/matrix constant folding (option B of #14330)

**Filed 2026-11-16 by jkwak-work** (human, maintainer-side; no labels; assignees unverifiable — GitHub API
401 auth outage, operator alerted 04:41Z, do NOT re-alert). Title: "Fold vector and matrix arithmetic on
constant operands in SCCP". This is **option B** from [#14330's triage](14330-cuda-vector-arith-static-const-dynamic-init.md)
(vector/matrix SCCP folding, the bigger change flagged with IRConstant risks / #12263) — #14467 already
landed option A (per-thread inlining). Their body names 4 concrete SCCP changes: remove the scalar-only
check (~slang-ir-sccp.cpp:1026), add a vector/matrix-of-constants lattice value (or fold when every
element is IRConstant), null-guard `evalCast`/`evalComparisonImpl`/`evalBitCast`/`evalSelect` against
vector operands, and diagnose divide-by-zero for vector divisors (lines 1070-1110, `isIntegralType`
scalar-only). Related: #13444 (casts — separate cause), #14330, #14467. Reads like a #14478 "missing fold"
case (constant-folding umbrella family, [#14473](14473-constant-folding-umbrella.md)).

**Intake 08:46-08:49Z (Main `sess-1794818813444-8tn8p1`):** no memory hit on the number itself; gh API 401
(outage) so no assignee check — dispatched anyway (R6: human-filed, no waiting period; jkwak-work asks
explicitly when they want the bot to stand down). **slang-triager dispatched 08:48Z** (msg id 7,
`in_reply_to=2`, thread `gh-issue-shader-slang/slang-14468`) → triager session
`sess-1794818923744-9kaxsx`, delivery verified. Follow-up context 08:49Z (msg id 13): cite #14478/#14473
in the triage comment; note whether #14468 should become a #14478 sub-issue (comment OK, umbrella edit is
maintainer-side).

**Scope: triage only.** Verify their file:line claims on master, dup-check (#13424 held / #14214 stood down
/ #14386 FP-NaN — none cover this; #13444 boundary: #14468 = arithmetic on constant vector/matrix operands,
#13444 = casts), classify (likely optimization/P3 — verify), ready-for-fix status. **GitHub writes may 401**
— attempt the post once, hold the draft and report back if it fails, no retry-loop. **No fixer**: whether a
bot draft PR is offered comes back to Main first (jkwak-work has been choosing "bot PR or I take it" on
#14330).

**On a reply / triager report:** verdict + held-comment state lands here; the #14330 park ("fold or
per-thread", "bot PR or they take it") is effectively answered by this filing — fold-direction chosen, so a
go-ahead here likely converts to a triager → fixer handoff on this thread. Keep #14330's record updated
when that resolves.

## Triage outcome (08:54Z, triager sess-…9kaxsx)

**enhancement (optimization) / low / IR (optimization passes) / P3** — not a regression, no dup (#13444 =
casts, distinct; gh dup-search unverifiable, API 401). All 5 of jkwak-work's code claims verified on
master `cdca151fb`, 2 corrections: (1) SCCP does full scalar evaluation — identity peepholes live in
slang-ir-peephole.cpp:217-265, immaterial; (2) do NOT introduce a vector-valued IRConstant —
`IRConstant::ValueUnion` (slang-ir.h:1067-1080) is scalar-only; folded results should stay
makeVector/makeMatrix trees of element literals (emitters handle them) — sidesteps the #12263 risk.
Latent unguarded `as<IRConstant>` derefs (evalCast :337 / evalComparisonImpl :574 / evalBitCast :875 /
evalSelect :954) are shielded by the :1026 gate today but must be guarded before it opens.
**Recommended approach A:** composite lattice values via make-trees — getLatticeVal recognizes
all-constant makeVector/makeMatrix (:263-274 aggregate TODO is exactly this work) → gate admits
vector/matrix result types → component-wise folds → component-wise/deferred div-by-zero (:1070-1111);
tryConstantFoldInst (:2008) reuse means peephole/specialize/translate inherit it. #14467's inline clause
(slang-ir-legalize-global-values.cpp:344) retirable as separate follow-up. Triager memo + held-comment
draft attached 08:54Z.

## Park (post-triage, 08:55Z)

- **Umbrella relation confirmed (triager 08:55Z): #14468 belongs under #14478 "Missing folds" (#14473)** as a
  sub-issue; membership edit is maintainer-side, a short suggestion comment on #14478 added to the held
  batch. Boundary vs #13444 holds (arithmetic-on-constants vs casts — distinct op classes/roots), with a
  caveat: #13444's body unreadable (API 401); triager re-confirms from its text on retry before the comment
  goes out. Held comment updated with plain same-repo refs #14478/#14473. Dup-check vs #13424/#14214/#14386:
  none covers this.
- **GitHub writes HELD (auth outage, operator alerted 04:41Z, no re-alert)** — three in the retry batch:
  (a) #14468 triage comment (umbrella-cited, carries the implementer question), (b) Issue Type Feature
  (read-then-set), (c) #14478 sub-issue suggestion comment. Draft + retry logic in the triager's workspace
  (memory/issues/comment-14468.md, memory/issues/14468.md). Main inspected the draft (inbox
  a2a-…-awen50/comment-14468.md): it already carries the **implementer question to jkwak-work**
  ("Decision with @jkwak-work: bot draft PR, or self-implement", Next-action bullet) plus the 5-bullet
  verdict and suggested order — no rework needed. **Retry ARMED: gated one-shot `i14468-gh-retry-4d56`,
  process-after 2026-11-16 15:00 UTC**, gate script gh-api credential probe (wake both branches:
  auth=ok → post-then-verify the three writes then #13444 body re-check + [Report]; auth=down → ONE
  exhaustion report + stop, no re-arm, never a recurrence). Draft opens with the explicit park-offer question
  ("want a bot draft PR for this, or will you take it?"). instructed (msg 19); triager reports when it lands
  or the one-shot exhausts.
- **No fixer** until jkwak-work's go-ahead routes through Main; then [Triage handoff] → slang-fixer on this
  thread. If they self-implement (as with #14467), close out like #14330.

## Writes landed (auth restored 09:09 UTC, triager [Report] 09:26Z) — park cleared to jkwak-work

- **Triage comment POSTED** (fresh, no prior comments): issuecomment-6912480246, opens with the explicit
  park-offer question to @jkwak-work ("want a bot draft PR for this, or will you take it?"). Comment id in
  the triager's .gh-comments idfile. **PATCHed in place 11:29Z** — the first post leaked the draft's OKF
  YAML frontmatter into the body; now stripped, body starts at **Status:** (gotcha recorded by the triager
  as a shared learning).
- **Issue Type set Feature** (was blank, read-then-set verified). No labels applied. Gated one-shot
  `i14468-gh-retry-4d56` CANCELLED after landing.
- **#14468 was ALREADY a formal sub-issue of #14478/#14473** (skiminki-nv linked it maintainer-side before
  the check) — queued #14478 suggestion comment correctly SKIPPED; triage comment cites the relation.
- **#13444 boundary correction (triager, PATCHed in place in the posted comment):** #13444 is the CUDA
  emitter turning layout-mismatched module-scope matrix initializers into dynamic `__device__` init
  (emit-path, labels regression/cuda/reproduced) — NOT "vector/matrix casts" as the dispatch context said.
  Even more clearly distinct from #14468's SCCP folding gap. Don't reuse the old cast characterization.
- **Parked on jkwak-work alone now** (implementer: bot draft PR vs self-implement). Reply arrives via
  webhook → Main first → on go-ahead, triager fires the [Triage handoff] to slang-fixer on this thread; if
  self-implement, close out as with #14330/#14467.
