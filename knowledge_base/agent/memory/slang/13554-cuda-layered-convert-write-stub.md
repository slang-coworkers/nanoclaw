---
type: chain
title: slang#13554 — CUDA/PTX formatted RWTexture{1D,2D}Array store silently dropped (empty `_convert` prelude stub)
description: External report (minco3), unassigned. Triaged P2 bug, reproduced. Draft PR #13563 got APPROVE_WITH_NITS, and the fixups are at e2eaf72e2a. It has never run GPU CI (draft, and the falcor gate needs ci-approvers). The last operator ask went out 10-11; the final check is 10-14 08:00Z, after which the chain parks.
tags: [slang, cuda, ptx, rwtexture, prelude, go, draft-pr]
---

# slang#13554 — layered `_convert` surface write is an empty stub

Reporter minco3 (NONE, external), filed 2026-10-09 ~23:11Z. Auto-assigned to jkwak-work 10-10 04:32Z (github-actions); labelled `regression` by jkwak-work 10-14. Thread `gh-issue-shader-slang/slang-13554`.
Main session `sess-1791587497477-4u2mkp`.

## State

- **Triage** (slang-triager, cmt [6091397893](https://github.com/shader-slang/slang/issues/13554#issuecomment-6091397893), labels
  `reproduced`+`cuda`, Type=Bug): reproduced on master 08d419cbf. `surf{1D,2D}Layeredwrite_convert` stubs at
  `prelude/slang-cuda-prelude.h` ~:1666/:1747 are empty. The store has been silent since v2025.21, when #8863 commented out #8644's
  non-dependent `static_assert(false)`; it never compiled to a working store. A layered `_convert` read is undefined (loud
  NVRTC error), so it is out of scope.
- **GO 2026-10-10 (Orchestrator):** Approach A as a **draft** PR (`Fixes #13554`). Inline `sust.p.a1d`/`sust.p.a2d`, mirroring
  `SLANG_SURF2DWRITE_CONVERT_IMPL`. Tests: a GPU-free PTX FileCheck plus a CUDA runtime test for CI. The ptxas 12.6 prototype
  assembles, but `sust.p.a{1,2}d` is not in the PTX ISA syntax table, so only GPU CI proves the conversion. The triager releases
  the HELD fixer.
- **Draft PR [#13563](https://github.com/shader-slang/slang/pull/13563)** opened 2026-10-10 04:32Z, `fix/issue-13554`, head
  `508fb1b3b2`. slang-reviewer started the A/B/C review at 04:44Z, ETA 30–40 min. If no verdict by ~05:30Z, treat it as a stall
  (see the #12627 lesson) and check that the reviewer actually sent a verdict.
- **Re-chase 05:35Z: no verdict, past ETA.** The PR has 0 reviews, and its only comments are bots plus our explain-diff. The reviewer
  session `sess-1791607364976-peo550` was last out at 04:44Z (the ack). Its container is `running`, cost `ok` ($3.64/$50), so it is not
  dead. The fixer `sess-1791590899034-uwucef` got no verdict. I nudged the reviewer at 05:36Z, pinned to its session on the canonical
  thread (msg 17), asking for the verdict to the fixer or the missing reviewer plus a new ETA. Follow-up task `rechase-13563-review-2`
  fires at 06:15Z: if there's still nothing, restart slang-reviewer and have the fixer re-request review.
- **Reviewer status, 05:41Z:** A is at 4 of 6 subagents. B (Devin) timed out and is skipped. C stalled on a denied tool call. The reviewer's
  own checks found 0 bugs: the revert drill fails 1/2 on master and passes 2/2 at head, ptxas sm_50–90 assembles, and 465/465 sweep tests pass. Verdict to the fixer by about 06:00Z,
  partial if A hasn't finished. Re-chase `rechase-13563-review-2-985a` (~06:15Z) covers it.
- **Verdict 06:16Z: APPROVE_WITH_NITS** (re-chase 2, 06:17Z, no restart needed). Reviewer msgs 11/13/15/17 hit the fixer as inbound
  seq 18/20, so it got both the combined-review.md and the verdict. 0 bugs. A finished. B (Devin) timed out and was skipped. Both C
  runs hung, so the reviewer used the clarity pass from A's run instead. ptxas 12.6 sm_50–90 assembles to SASS
  `SUST.P.{1D,2D}_ARRAY`; ptxas gates "sust.p with array geometry" at PTX ISA 4.1, and Slang emits 8.5. All 10 store operand sets
  were hand-checked. Revert drill: on master the PTX lane fails (1/2), at head it passes 2/2. Sweep 465/465. **Fixer asks:** (a)
  add one `"r"`/uint gfx texture (e.g. rgba8ui RWTexture1DArray<uint4>); (b) a `docs/cuda-target.md` sentence that 3-vector, half
  and 64-bit element types fail at NVRTC; nits on the tolerance comment and the `…CUDA` test name; confirm "I6". (I6 is not in my GO text; the fixer self-check numbering, see the 06:28Z correction below)
  Nothing posted to GitHub (no post-authorized marker). After the
  fixes the PR is review-ready, apart from the ci-approvers gate.
- **I6, 06:2xZ:** my GO had no numbered list. I told the triager that I1–I7 was its handoff numbering, and **that was wrong**: the
  triager confirmed (06:28Z) that its handoff and GO relay are unnumbered prose. I1–I7 is the fixer's own self-check. The triager has
  asked the fixer to quote I6 and will answer it. Both gaps and the nits are confirmed in scope, and the PR body's revert-drill count
  should be corrected to 1/2. Re-chase `rechase-13563-fixups-8637` (08:00Z) checks for the new head and the [Fix Report].
- **Re-chase 2 close, 06:31Z:** the fixer container is `running` (last_active 06:28Z, $25/$150) with no outbound since the verdict.
  The triager's go-ahead reached it at 06:28Z (inbound seq 22). The head is still `508fb1b3b2`. This is not a stall, because it is
  13 min after the verdict and 3 min after the go-ahead. Escalation path: if it is silent at 08:00Z, nudge the triager, not the fixer.
- **Re-chase fixups, 08:0xZ: the fixer went silent.** Head is still `508fb1b3b2`: no push since 04:24Z, and the PR has 0 reviews and no new
  comments. The fixer container is `stopped` (last_active 06:28Z, cost `ok` $25/$150). Its last outbound is msg 21, the 04:43Z
  PR-opened note, so the 06:28Z go-ahead (inbound seq 22) went unanswered. No [Fix Report] and no I6 quote. This is the only fixer session on
  `…-13554`, so there is no phantom. The triager `sess-1791587625674-k655uq` is `running`; its last out was 06:28Z. **I nudged the triager**
  (msg 23, pinned, canonical thread) to wake the fixer and get a [Fix Report] with the new head. GPU CI: run 38024444265 is still
  `waiting` at `falcor-build-approval-gate` (env `falcor-ci`, `current_user_can_approve=false`). Next re-chase is
  `rechase-13563-fixups-2-e3ad` at 09:30Z. If nothing has moved by then, restart slang-fixer with a `--message` re-stating the fixups.
- **08:1xZ: the fixer is silent on the fixups.** The head is still `508fb1b3b2` (I checked with ls-remote). The triager re-woke it at 08:08Z (msg 25, pinned).
  Its container is `running`, last_active 08:08, cost ok ($25/$150). It has 4 running sessions (13554/13555/13556/11709), so it may just be
  busy, not wedged. `rechase-13563-fixups-2-e3ad` (09:30Z): if there's still no push or ack, restart slang-fixer with a `--message` restating the fixups.
- **08:10Z: the fixer acked** (via the triager, msg 82). It's applying the fixups, keeping the PR as a draft. The restart is withdrawn, and the fixups-2
  re-chase was rewritten so it doesn't restart a quiet fixer. The fixer says the triager's 06:28Z go-ahead "never reached" it. The fixer's
  inbound.db *does* hold it (seq 22, 06:28:10Z), so it was delivered to the DB but never processed by a turn. The lesson: a row in
  `messages_in` doesn't mean the agent saw it, so a silent recipient needs a re-wake, not an assumption that it's working.
- **08:29Z [Triage Resolution]: fixups pushed, head `e2eaf72e2a`** (I checked live; still draft; +336/−14 across 5 files). The delta from 508fb1b
  touches only docs and the gfx test, prelude untouched. It adds the rgba8ui uint4 1D-array exact readback, the unsupported-type docs sentence, the
  rename to `cudaLayeredFormatWriteCUDA`, the tolerance comment, and revert-drill 1/2 in the body. Fixer local: 444/444. **GPU CI at e2eaf72: none.** The
  pull_request CI 38037371701 skipped all 50 jobs (draft). The only GPU-capable run, 38024444265, is pinned to the old 508fb1b and still waiting at
  `falcor-build-approval-gate`. **Operator decision asked 10-10 08:3xZ:** (a) dispatch at e2eaf72 and get it approved [recommended, covers the
  uint lane] / (b) approve the old run / (c) leave it. Re-chase `rechase-13563-fixups-2-e3ad` repurposed → 10-11 08:00Z. The triager rests;
  it sends only a final note on merge. PR stays draft until GPU CI has run.
- **Re-chase 10-11 08:0xZ: no operator answer, nothing moved.** No reply on the dashboard since the 10-10 08:30Z ask (msg 492300). I checked live: head is still `e2eaf72e2a`, still a
  draft, 0 reviews, bot-only comments, and #13554 has no new comments. **No run exists at e2eaf72** other than the skipped pull_request CI (0 workflow_dispatch
  runs). 38024444265 (508fb1b) is still `waiting` at `falcor-build-approval-gate`, 27 h old, `can_approve=false`. So `cudaLayeredFormatWriteCUDA` has **never run
  on a GPU**. I sent the 2nd and **LAST** ask to orchestrator-dashboard (msg 7) with the same (a), (b) and (c) options. The final check is `rechase-13563-final-95f1` on 10-14 at 08:00Z.
  If there's still no answer then, park the chain as draft-held: no more asks and no timer.
- **10-14 00:49Z: jkwak-work commented** ([6158362037](https://github.com/shader-slang/slang/issues/13554#issuecomment-6158362037)):
  "It appears that this is a regression from the following PR: #8863", and added the `regression` label (00:49:13Z; `optix` was added 10-12).
  **Correction: the issue is NOT unassigned.** github-actions[bot] auto-assigned jkwak-work on 10-10 at 04:32:50Z, when PR #13563 opened. The comment
  agrees with the triage's history (#8863 made the error silent), but it overrides the triage's "not a regression" call. I routed it to the triager on the canonical thread:
  reconcile the classification with a fresh delta comment (a human has commented since 6091397893), point to draft #13563, and ask the assignee
  whether to un-draft it so GPU CI runs. The assignee being engaged may make the pending operator CI decision unnecessary. `rechase-13563-final-95f1` was moved to 10-16 08:00Z and rewritten: no more operator asks; park if the maintainer is silent.
- **10-14 00:55Z: the triager posted delta cmt [6158442564](https://github.com/shader-slang/slang/issues/13554#issuecomment-6158442564).**
  It accepts the #8863 regression attribution, points to draft #13563 at e2eaf72e2a, says GPU CI has never run, and asks jkwak-work one question:
  un-draft for GPU CI, or a different approach (error / #11090)? It also notes the #13363 coupling. Now **awaiting jkwak-work**. Un-draft or CI →
  fixer, via the triager. A design change comes back to me. Re-chase `rechase-13563-final-95f1` (10-16 08:00Z).
- **Triager check, 04:49Z:** within scope (prelude +129/−14, a PTX FileCheck, a CUDA gfx-unit-test that reads texels back, a docs
  line). Issue cmt 6091397893 was edited in place. **GPU CI is gated:** dispatch run 38024444265 (head 508fb1b3b2) is `waiting` at
  `falcor-build-approval-gate`, and check-ci failed downstream (I checked it live 04:5xZ). Releasing it needs a ci-approvers human
  (same gate as #13436/#13544). Operator told 10-10.
- Basis for GO without a maintainer: the issue is unassigned with an external reporter, the change is a prelude-only bug fix,
  a draft PR pre-empts no owner, and #12630 is precedent (the maintainer chose to implement a stub of the same class).

## Coupling (don't fold in)

- #12627 / draft PR #13363 (ours, held on jkwak-work): `getCUDASurfaceAccessInfo` sets `isConversionAvailable = !isLayered` for
  writes (E56007 on the subscript path only). If #13554 lands first, that rule goes stale, so flip it in #13363. Don't edit #13363 from this chain.
- #13364 (jkwak-work, Q1 2027) and #11088 / draft #11090 (skallweitNV; csyonghe + jkwak-work) are human-owned. If #11090 lands
  it replaces this prelude path.
