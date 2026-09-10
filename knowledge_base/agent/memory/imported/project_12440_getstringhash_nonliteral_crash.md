---
name: project_12440_getstringhash_nonliteral_crash
description: "slang#12440 getStringHash on a non-literal SIGSEGVs instead of E41023. FIX DELIVERED as PR #12464 (fix/issue-12440, head c5ff51285a64) and reviewed once (approver WOULD_APPROVE; NO triager review of the diff exists). Chain now waits on a HUMAN maintainer verdict only. Gate i12440-fix-pr-gate-8e14 re-armed 08-11 to key on state change, not on PR existence."
metadata:
  node_type: memory
  type: project
  originSessionId: d5953db7-c37f-41d6-9915-53abce38ba90
---

# slang#12440 — `getStringHash` on a non-literal crashes instead of diagnosing

**State 2026-08-11T12:1xZ (re-measured this turn):** issue **OPEN**, last commenter
`nv-slang-bot`. **PR #12464 is the fix**, from `fix/issue-12440`, head `c5ff51285a64`, non-draft,
17 files, `MERGEABLE`, body carries the 5-part description + `Fixes #12440`. master HEAD now
`ec47ea72b` (was `5695205609` at the prior gate fire, `716ec597f` at triage).

**The chain waits on a human maintainer verdict.** Requested: `jvepsalainen-nv` (auto-assigned
shepherd) + `bmillsNV`. ⛔**Do not nudge slang-fixer; it has delivered.** A nudge to the fixer is
the wrong tier.

⛔**CORRECTION TO MY OWN CLAIM, caught the same turn I wrote it.** I put *"reviewed twice —
slang-triager reviewed the diff against its three checks"* into the gate prompt, then measured:
`pulls/12464/reviews` → **0**, `pulls/12464/comments` → **0**, and issue #12440 has exactly 4
comments — triage `08-09T20:43Z` (**pre-PR**, on the *reporter's suggested patch*), the reporter's
handoff, and the fixer's two PR announcements. **slang-triager never reviewed this diff.** I
manufactured a review by conflating the pre-PR triage verdict with a review of the delivered fix —
the PR did not exist when that comment was written. What actually exists: slang-pr-approver's
`WOULD_APPROVE / CLEAN` ([[project_12464_getstringhash_nonliteral_e41023]]) and my own
read-and-reason scoring below (**not** build-and-measure). Prompt corrected before its first fire.
⇒ ⭐⭐⭐**A chain's earlier verdict is evidence about the artifact that existed THEN. Re-dating it
onto a later artifact invents review coverage — and it reads as reassurance, so nobody re-checks
it.** Related: [[feedback_a_reference_keyed_gate_cannot_see_an_artifact_older_than_its_referent]].

## ⭐⭐⭐ My own constraint was RIGHT ABOUT THE REQUIREMENT, WRONG ABOUT THE REMEDY

I dispatched with *"the guard needs reachability/liveness scoping"*. **The PR does not teach the
checker liveness at all.** It moves the existing `eliminateDeadCode` call from just *after*
`checkGetStringHashInsts` to just *before* it (`source/slang/slang-emit.cpp`), so the leftover
helper body is deleted before the check walks the module. Verified in the diff on my edge this turn:

```
+    eliminateDeadCode(irModule, fastIRSimplificationOptions.deadCodeElimOptions);
     if (!ArtifactDescUtil::isCpuLikeTarget(artifactDesc) && … shouldRunNonEssentialValidation())
         SLANG_RETURN_ON_FAIL(SLANG_PASS(checkGetStringHashInsts, sink));
-    eliminateDeadCode(irModule, fastIRSimplificationOptions.deadCodeElimOptions);
```

That satisfies the **requirement** (`h("aaa")` still compiles) by a *more* principled route than
the remedy I named — the alternative would duplicate DCE's roots, `KeepAlive` handling, CFG
reachability and weak refs inside the checker.

⇒ ⭐⭐⭐**A constraint stated as A REMEDY scores a correct fix as non-compliant.** A reviewer
checking my literal words for "scoping inside the checker" would report check (a) unmet on a diff
that meets the requirement. **State constraints as the behaviour that must hold, plus the test
that proves it — never as the implementation you imagined.** This is the same
wrong-scope family as the ANCHOR F carve-out: right about what it named, wrong about what it
covered. Warning now carried in the gate prompt itself so the next reader cannot repeat it.

## Triage's three checks, scored against the diff on my edge

| check | verdict |
|---|---|
| (a) `h("aaa")` still compiles | **met** — via the DCE reorder above, not checker scoping. PR body says the helper test reports `E41023` if the reorder is dropped, i.e. it was confirmed as a real regression guard. |
| (b) static-`String` test case | **met** — `tests/diagnostics/get-string-hash-non-literal.slang`, `static String g = "aaa"`, no run-time select anywhere. Exactly the shape asked for. |
| (c) 3 sibling emitter sites | **met** — spirv:5975, wgsl:1711, llvm:2178 all take the checked `as<IRStringLit>(getOperand(0))`, plus c-like. **LLVM correctly marked UNVERIFIED, not latent**: body says *"not claiming a crash fixed there… a bounded negative over shapes tried, not proof of unreachability"* (4 operand shapes tried). The distinction I insisted must not be flattened was preserved. |

## CI at the head — and what I could NOT read

Run `31446085572` @ `c5ff51285`: **32 success / 1 failure / 5 queued / 1 waiting**; run-level
`status: waiting` describes only the tail (ANCHOR G — enumerate jobs).

**18 test jobs green at this head**, incl. linux-aarch64 debug+release, macOS-aarch64
debug+release, linux-x86_64-**cpu**, windows-release dx/vk/cuda, windows-debug vk/cuda. ⇒ the 5
queued x86_64-linux jobs would add **platform breadth, not a first execution** of the changed
paths.

⚠️**The one red job's log is UNREADABLE right now.** `test-windows-debug-cl-x86_64-gpu-dx /
test-slang`, failed step `Test Slang`, completed `01:34:37Z`. `gh run view --log` refuses
(*"run is still in progress; logs will be available when it is complete"*) and
`/actions/jobs/<id>/logs` returns empty. **The `bufferBarrierVulkan`/RPC attribution is
slang-pr-approver's, second-hand — I did not re-derive it** (ANCHOR C). Recorded as unread, not as
agreed.

## Two independent blockers on the head settling — neither caused by the diff

- **Linux GPU pools dark.** My probe this turn: 30 `ci.yml` runs spanning `08-11T06:53Z→11:59Z`,
  **zero** runner assignments on `Linux,self-hosted,GPU,GCP` or `,SM80Plus`. ✅**Positive control
  in the same query**: 12 other label sets assigned, incl. `Windows,self-hosted,build` at
  `12:02:52Z` (7 min before measurement) ⇒ **two pools, not a platform.** Details:
  [[project_linux_selfhosted_gpu_pool_outage_2026_08_10]].
- **falcor-ci pending deployment**, re-verified live: `wait_timer=0`, `wait_timer_started_at=null`,
  `current_user_can_approve=false` ⇒ **no elapsed-time path at any duration**; human-only.

## Gate `i12440-fix-pr-gate-8e14` — RE-ARMED 08-11T12:2xZ

⛔**The old `pr_from_fixer_branch` arm keyed on "an open PR exists from that branch", which stays
true for the PR's whole life ⇒ it would re-dispatch the same completed review every 6 h forever.**
Replaced with state-change arms: `pr_MERGED`/`pr_CLOSED` · `human_review:<login>:<STATE>` ·
`human_pr_comment:<login>` · `pr_back_to_draft` · `pr_head_moved` off `c5ff51285a64` ·
`issue_CLOSED` · `new_human_issue_reply` · `no_human_review_96h_ESCALATE_OPERATOR`.
⇒ ⭐⭐**An arm keyed on a STATE reads as an event on every fire. Key on the transition, or pin the
value you already acted on** (here: `REVIEWED_SHA`). Silence arm re-keyed to the
**PR-ready** clock (13 h at install), because the fixer is done and the waiting party is a human.

### ⭐⭐⭐ The must-hit control found TWO real defects the quiet reading hid

My first filter excluded automation by testing the login for `bot`. It reported `wakeAgent:false`
— **and that clean reading was wrong twice over**:

1. `jhelferty-nv` — a **human-named account** — posts `pr-board-sync` notices saying *"do not
   reply to this comment"*. My reviews/comments probe woke on it as a human. ⇒ **automation is a
   property of the BODY, not the account name**; now excluded on the marker text.
2. Running the must-hit forward (find a PR whose filter output is non-empty) surfaced
   `coderabbitai`, then `CLAassistant` — **review bots whose logins contain no `bot` substring**,
   both of which would have woken the gate as human verdicts.

Neither was visible from the `false` reading: an over-broad exclusion and a genuinely quiet PR are
byte-identical. The control only terminated on a real person (`jvepsalainen-nv` on #12448, a
substantive SHA correction) after both fixes. ⇒ ✅**For any "no X yet" gate, run the filter
FORWARD until it hits a true positive — a filter's silence never distinguishes "nothing happened"
from "I excluded it".** Same family as [[feedback_a_control_returning_zero_is_unproven_until_a_must_hit_fires]].

**Cancel this series once 12440 closes with a merged diff carrying BOTH the checked
`as<IRStringLit>` cast AND the DCE reorder.**
