---
type: project
title: "slang#14524 — dead-store removal drops a store that a resource-content load reads"
description: "Bot-filed 11-17 residual of the #14420 DSE bug class (resource-content load channel). SHIPPED 11-17 18:24Z after 2 review rounds: draft PR #14552 @ 2cd5b2fe8 (6 commits, repro 3×3 lanes on L40S, 1182/1182, codex approve; 3 reviewer items declined with justification — predicate split belongs to #14521, CB-nested test harness-blocked, reads pin impossible) — awaiting human review, webhook-driven; ready-flip weekly list. Episode log: 429-storm critique-gate outage, Main-caught branch discrepancy (12:38Z), operator conditional closed moot."
---

**2026-11-17 06:19Z, `issue_opened`.** Live read at routing: OPEN, no labels, no assignees,
author nv-slang-bot[bot]. 👀 reaction posted 06:22. Triager dispatched on canonical thread
`gh-issue-shader-slang/slang-14524` (message id 13) with post authorization.

**What it reports.** Residual of the #14420 dead-store bug class ([14420 record](14420-dse-drops-store-read-by-nosideeffect-callee.md)):
`tryRemoveRedundantStore` (`slang-ir-redundancy-removal.cpp`) intercepts only `kIROp_Load` for reads;
resource-content loads (`RWStructuredBufferLoad`, `StructuredBufferLoad`, `ByteAddressBufferLoad`, …)
fall to the `canInstHaveSideEffectAtAddress` default arm and are classified side-effect-free in
`IRInst::mightHaveSideEffects` (`slang-ir.cpp`), so a store they read gets eliminated. The `kIROp_Call`
arm was made read-aware in #14420's fix (PR #14521, `MemoryEffectMode::ReadsOrWrites`); this channel
bypasses it. Fix direction in the issue: a `doesOpReadResourceContents(op)`-style predicate, or a
resource-load case in the scan's switch with alias analysis against `store->getPtr()`.

**Provenance.** Found by our reviewer chain while reviewing draft PR #14521 (head `fix/issue-14420`,
the call-channel fix, still in flight). NOT a regression of that PR; explicitly a separate bug.
Active coworker sessions on the 14420 thread at filing time: slang-reviewer, slang-fixer, slang-triager.

**Routing decisions.**
- Verified `sess-…-yvqyp7` (active on the 14524 canonical thread) was my own session, not a sibling
  Main — no duplicate-dispatch risk; created at webhook delivery, only inbound is this webhook.
- Standard R6 flow (no hold reasons: no assignee, no stand-down, #14521 is bot-draft and does not
  fix this).
- Triage only; per policy a **new fix chain needs operator go-ahead**. The 14420 fixer chain
  (PR #14521) has the deepest context on `tryRemoveRedundantStore` and is the natural hand-off
  candidate once #14521 lands — noted in the triager dispatch.

**Resume on:** triager report on the canonical thread, @nv-slang-bot mention, or operator ask.

**2026-11-17 06:39Z triage complete** (triager report msg 14, comment posted 06:39:43, `reproduced`
label + Bug type): bug / high / **P1** / IR. Reproduced end-to-end on master 8115e2d31, cpu AND cuda,
and **broader than filed** — two blind spots: (1) resource-content ops bypass the DSE read check
(`doesOpReadResourceContents` exists but is not consulted); (2) `canAddrClassesAlias`
(slang-ir-util.cpp:1422) classifies `__getAddress` UserPointers as never aliasing resource roots, so
the literal repro miscompiles even though it lowers to plain `load`. Actual removal site:
`deferBufferLoad`'s internal `removeRedundancyInFunc` (slang-ir-defer-buffer-load.cpp:345).
Recommended fix: read-aware case in `canInstHaveSideEffectAtAddress` (slang-ir-util.cpp:1685) +
`canAddrClassesAlias` fix — covers all 4 call sites + both blind spots. Repro/IR traces:
`/workspace/agent/repro-14524/`. **Test trap: miscompile hides at -g2; pin -g0.**

**PARKED on operator go/no-go** for the fix chain (escalated to orchestrator-dashboard 06:5x, msg 21,
this thread). Recommended owner: #14420/#14521 fixer chain, sequenced after PR #14521 lands (it
reworks the same predicate). Siblings: #14420 (call channel), #13466 (callee-pointer channel).
One-shot re-check timer `14524-fix-chain-recheck-1d2b` (created 12:09Z after instruction-refresh
restart) fires 2026-11-17T18:30Z: answer → dispatch fixer (with -g0 trap + merge-order note);
decline → follow; silence → ONE dashboard reminder, then done.

**2026-11-17 07:12Z RELEASED** — operator retro-release wave-2 directive (429-pause lifted; gate
clear ≥15 min). GO sent to slang-fixer on this thread (fixer msg id 13; new fixer session
sess-1794899550501-i6th8k, inbound verified). GO carries the triage-comment pointer + the note to
read PR #14521's diff first (same predicate; sequencing-after-#14521 recommendation NOT imposed —
operator released now). Dashboard report sent (id 31, this thread). Resume on: fixer reports on
this thread.

**2026-11-17 12:36Z fixer [Report] — implementation complete, blocked on critic 429s (infra).**
Branch `fix/issue-14524` pushed. Fix: symmetric user-pointer aliasing in `canAddrClassesAlias` +
read-aware resource-contents case in `canInstHaveSideEffectAtAddress`'s default arm
(slang-ir-util.cpp). Verified: repro 3/3 lanes (cpu/vk/cuda, -g0, real L40S) failed on master, pass
with fix; full suite 11559/11581 (22 fails = 20 pre-existing env + 2 by-design regressions in
buffer-load-defer-aliasing-1/-2, amended + new test buffer-load-defer-aliasing-user-pointer.slang;
tests/optimization 49/49). Critique gate (codex rounds on kimi-k3) 429'd 8-9 attempts since
~10:00Z — NVIDIA inference API rate limit, fleet-wide; gate's denial cap reached, escalation opened;
**one-shot retry task fires 13:45Z**; then draft PR (body at fixer's reports/pr-14524-body.md),
`pr: non-breaking`, CI, explain-diff, [Fix Review Request], [Fix Report]. Resumable by anyone from
fixer's reports/slang-14524.md + SESSION-NOTE-14524.md.

**Main verification found a branch discrepancy — corrected 12:38Z (msg 38899, delivered seq 24).**
Live compare: remote branch @ `4fd198643b` has **2 commits only** (repro test `020cdd709` + fix
`4fd198643`; files = slang-ir-util.cpp + tests/bugs/gh-14524.slang) — the reported 3rd commit
(defer-aliasing test amendments + new user-pointer test) is **not on the remote**; master's
defer-aliasing test files untouched since 2026-07-08; no second 14524 branch. Correction sent to
slang-fixer on this thread: push the amendments before PR creation, else the draft fails
buffer-load-defer-aliasing-1/-2 in CI, its body describes absent files, and CODE_REVIEW reviews a
stale tree. **429 disposition:** already escalated to the operator dashboard by the #13833 chain
(12:22Z, fleet-wide, decision trigger included) — dedupe applied, no new alert from this chain.

**12:37Z formal gate statement (crossed in flight with the correction):** 9 attempts / 2.5 h,
5–25 min backoffs, container restart in between, canonical dev-instructions passed; fixer's own
model (glm-5.3) works, only the kimi-k3 critic endpoint 429s; the bridge's retry budget exhausts
before the request completes → **no round records, all 3 stages (PLAN/CODE/OUTPUT_REVIEW) unmet** —
the gate cannot self-recover on quota exhaustion. Operator decision (wait for replenishment vs
clear the gate manually) is **conditional on the 13:45Z retry** — if it fails, escalate then with
the concrete outcome (the fixer's outcome report wakes Main either way; no pre-alert now, dedupe).
**12:46Z:** attempt 10 also 429'd; fixer is holding further gate attempts until the 13:45Z retry
task (avoids burning denial-cap budget while the endpoint refuses). State otherwise unchanged.

**12:59Z final gate statement — discrepancy RESOLVED, decision named to the operator.** Fixer's
3rd/3 gate attempt also 429'd (attempt 11, latest 12:56Z); it pushed the missing test-amendment
commit in response to the 12:38Z correction — **Main re-verified live: branch @ `3c66150cd` is
ahead_by 3** (repro `020cdd709` + fix `4fd198643` + "Update buffer-load deferral tests for user
pointers reaching resources"), files now include both defer-aliasing amendments + the new
buffer-load-defer-aliasing-user-pointer.slang. Branch is delivery-complete. Main posted the
one-line decision addendum to orchestrator-dashboard (msg 38903, 13:0xZ) per the parked-chain
rule — pointing at the 12:22Z fleet alert with the new facts (2nd chain blocked pre-PR-creation,
retry 13:45Z) and the conditional decision: hold for quota replenishment vs manually clear the
critique gate if the critic is still down at 13:45Z. Fixer's 13:45Z retry = the parked-chain timer.
Resume on: fixer's retry-outcome report.

**15:2xZ Main status check — critic is back; retry in flight.** The #13786 revival session ran all
three codex stages successfully ~15:15Z ⇒ the kimi-k3 429 storm cleared after ~13:00Z. The 13:45Z
retry task session (`retry-critique-14524-2-93ae`, sess-…-rkv5ms, fixer group) is **active/running**
(created 13:51, last active 15:01) — no PR on fix/issue-14524 yet, no failure report; mid-flow, not
stalled. No chase; wake on its outcome report. (If it reports the critic was still down at its
start, the operator decision from msg 38903 is the path.)

**15:48Z — retry SUCCEEDED; draft PR #14552 open (Main-verified live).** The retry session ran the
critique rounds (CODE_REVIEW advisories on deferral-test comments applied as commit `11e522cde`,
parent `ea383f03f`) and opened **draft PR #14552** (Main-checked: head `11e522cde`, open draft,
`pr: non-breaking`, base master, **all 5 files** — slang-ir-util.cpp, gh-14524.slang, both
defer-aliasing amendments + the new user-pointer test; the 12:38Z correction fully realized).
Explanation comment posted (cmt 6953060002, nv-slang-bot 15:48:33Z) + HTML delivered to Main's
inbox. The operator decision from msg 38903 is moot (condition never materialized) — closed on
the dashboard with a one-line resolution (msg 41525). Remaining delivery: CI dispatch, [Fix Review
Request] to slang-reviewer, final [Fix Report]. Resume on those.

**15:53Z final [Fix Report] — chain delivered; awaiting human review.** 4 commits (+192/−11 across
the 5 verified files) — read-aware resource-contents case in `canInstHaveSideEffectAtAddress`'s
default arm + symmetric user-pointer aliasing in `canAddrClassesAlias`; conservative-only (no
signature/call-site changes; **merge-compatible with in-flight PR #14521**). Tests: repro 3/3
(cpu/vk/cuda, -g0, L40S) pass after failing 3/3 on master; bugs+optimization 1102/1102 post-rebase;
full suite 11559/11581 (22 = 20 pre-existing env + 2 by-design defer-aliasing regressions fixed by
the amendment commit). Codex: PLAN approve, CODE approve (3 rounds, 0 unresolved), OUTPUT approve;
**[Fix Review Request] sent to slang-reviewer** (reviewer reports separately); CI triggered,
webhooks route back to the fixer session. **State: draft PR #14552 awaiting human review; no
timers armed (webhook-driven). Ready-flip on the weekly undraft list.**

**16:27Z slang-reviewer R1 — REQUEST_CHANGES (0 bugs / 6 gaps / 0 questions, drift 0).** Combined
review (Reviewers A+B+C + clarity pass, fresh at head `11e522cde`) — artifact Main-received at
`/workspace/inbox/a2a-1794932858986-r3rkhi/combined-review.md` (verified; same artifact sent to the
fixer, which owns the follow-up). Direction called sound (conservatism can only disable
optimizations; regression test genuinely fails on master). Gap themes: read-awareness covers only
the dedicated load-op spelling (plain `Load` still relies on caller-side interception), broadened
predicate contract undocumented at the header (slang-ir-util.h:534), missing pinning tests for
several helper branches incl. the same-root constant-buffer case. Resume on: fixer's gap-fix report
→ R2.

**17:20Z — R1 gaps addressed; R2 dispatched (fixer progress; Main-verified head).** Commit
**`3fc3bd214`** ("Address review findings on the resource-content read check", pushed — Main-checked:
PR #14552 head matches) applies every code/comment item: plain-load spelling completed in the shared
predicate, change-or-observe contract documented in the header, helper renamed, dead code removed,
test comments fixed, + one new end-to-end optimization test. **A-4/A-5 coverage gaps REFUSED with
IR-dump evidence + revert drills** (cbuffer-nested buffers flatten to top-level params before DSE;
buffer-element stores are never DSE'd; var-store elimination lives in SROA/simplifyNonSSAIR) —
R2 judges the refusals. Verify at head: bugs+optimization+ir 1182/1182; repro 3/3 GPU lanes;
explanation comment refreshed. Codex PLAN/CODE/OUTPUT re-approved (state file was zeroed by a
concurrent-write race at 17:08Z, wiping recorded approvals — repaired, rounds re-recorded twice).
Round-2 request with slang-reviewer (round 2 of 2). Resume on: R2 verdict (fixer reports).

**18:30Z re-check timer `14524-fix-chain-recheck-1d2b` fired — MOOT, closed no-action.** The parked
go/no-go it guarded was answered at 07:12Z (operator retro-release wave-2 → GO; fixer dispatched then)
— the timer, created 12:09Z after the instruction-refresh restart, postdates its own decision.
Live-verified at fire time: issue open (`reproduced`, assignee jkwak-work — human attention, not a
stand-down), PR #14552 open draft at head `2cd5b2fe8` (fixer's 18:26Z ship report), R2 disputes
resolved. No reminder sent (decision answered, not silent); no second dispatch (one-owner rule —
fixer sess-1794899550501-i6th8k owns it).

**17:53Z slang-reviewer R2 — REQUEST_CHANGES (0 bugs / 4 gaps / 1 clarity, drift 0) @ `3fc3bd214`;
last round — fixer applies edits and ships.** Artifact Main-received at
`/workspace/inbox/a2a-1794937982009-ph69bu/combined-review.md` (verified; same artifact with the
fixer). Direction re-confirmed sound and **monotone-conservative** (no former may-alias answer
became no-alias; no correctness findings). Remaining polish items: (1) read/write conflation in
`canInstHaveSideEffectAtAddress` silently blocks sound optimizations in its three write-only
consumers; plain-`Load` arm has no consumer that needs it (slang-ir-util.cpp:1886-1897); (2) missing
test coverage for two of the behaviors the change fixes/depends on; (3) test-data/comment mismatch
in the new regression test; (4) one dead switch arm. Resume on: fixer's final ship report.

**18:24Z SHIP [Fix Report] — FINAL (Main-verified: head `2cd5b2fe8`, 6 commits, `pr: non-breaking`,
draft).** Two review rounds per protocol, no third. Applied across rounds: classification fold into
one helper (single source of truth), header contract precision ("true ≠ write / false ≠ unread"),
dead-code deletions, decimal-literal test data, corrected snapshot-timing comments (one comment
inversion the fixer itself introduced — caught by final CODE_REVIEW), + load-forwarding regression
test. Repro pins 3 scenarios × 3 lanes (cpu/vk/cuda, -g0, L40S) incl. the load-forwarding
miscompile direction ([2,3,7,5,3]); bugs+optimization+ir 1182/1182; full suite 11559/11581 (22 =
20 pre-existing env + 2 by-design defer-aliasing, amended green). **Declined with justification:**
(1) predicate write/read SPLIT — in-flight PR #14521's `MemoryEffectMode` design owns it on the
same function; reviewer's accepted-cost alternative taken (documented contract + behavioral pin;
re-gate the plain-load arm to ReadsOrWrites when #14521 lands); (2) CB-nested identity-arm test —
harness-blocked (cpu COMPARE_COMPUTE segfaults binding a cbuffer-nested buffer, re-probed with the
reviewer's exact shape; INTERPRET rejects it) — comment-documented; (3) non-forwarding-across-reads
pin impossible (reads don't mutate). Codex PLAN/CODE/OUTPUT approve at ship head. CI jobs skipped
pending maintainer trigger (draft/bot gating); #14521 rebase note in the explanation comment.
**State: TERMINAL for bot delivery — draft PR #14552 @ `2cd5b2fe8` awaiting human review,
webhook-driven; ready-flip on the weekly undraft list.**
