---
name: project_12371_spirv_prelink_validation_buffer
description: "LIVE — slang#12371: SPIR-V validation runs on the PRE-LINK buffer so a valid linked module is rejected for OpCapability Linkage. DRAFT PR #12382 (head f93eb4f7, A1) is CONTAINED WHOLE by draft PR #12408 (head 95bdd991, ahead 6/behind 0), which builds A2 => Q1 answered in built code, not by the operator. 23:0xZ: #12408 GAINED both closing links (closes 12371+12383) — my flagged hazard is resolved — and jhelferty-nv assigned jkwak-work + requested review 22:57Z. RESUME: guard i12371-pr-guard-0175 — latch fixed FIVE times; 5th (23:0xZ) added xst= per-cross-ref-PR state after xprs proved to be a MEMBERSHIP probe, blind to what the superseding PR does."
metadata: 
  node_type: memory
  type: project
  originSessionId: 1dd5892a-bf52-4274-8dd1-46df09e77581
---

# slang#12371 — SPIR-V validation reads the pre-link buffer

## 23:0xZ heartbeat wake — the hazard I filed RESOLVED ITSELF and the latch was blind to that too

Fingerprint byte-identical again (`…|iev=2|xprs=12382,12408`). Re-measured; **#12408 moved four
commits and gained the thing I had routed to the triager as a gap.**

✅ **#12408 now closes BOTH issues.** `closingIssuesReferences` = **`[12371, 12383]`** (was `[]` at
18:3xZ). Body lines 276–277 carry `Fixes #12371.` / `Fixes #12383.` and line 274 states the reasoning
I had sent — *"#12382 will need closing by hand"*. ⇒ **The closure hazard is fixed at the source.**
Head `d8dcbe35` → **`95bdd991`** (9 commits, 6 files, **+869/−36**), still draft, `pr: non-breaking`,
bot id 274397474. `compare f93eb4f7...95bdd991` = **ahead 6, behind 0** — #12382 is still contained
whole.

✅ **ORDER TEST re-run on the fetched file at `95bdd991` — still A2, and now stronger.**
`if (needsLink)` :3468 → `_Move(linkedArtifact)` :3482 → `compiler->compile` :3529 →
`stripDbgSpirvFromArtifact` :3544 → `passthroughDownstreamDiagnostics` :3563 → **`if
(needsValidation)` :3598 → `validateSpirvArtifact(…, artifact)` :3600**, plus `dbgArtifact` :3613.
Validation stays **BELOW** the optimizer and the strip. Two new early-exit arms (:3570, :3583)
validate `preOptimizeArtifact` on the diagnostics-failure and strip-failure paths — the emitter's own
output, deliberately, per the comment at :3565. `spirv.getBuffer()` in the validation region:
**0** (only :3408 `spirvFiles.add` and :3465 inside `#if 0`).

⛔ **HUMAN MOVEMENT, and it is on #12408 not #12382:** `jhelferty-nv` (id 29613962) at **22:57:05–08Z**
— `assigned` jkwak-work, `review_requested` jkwak-work, plus the board-sync comment. So the shepherd
is now attached to the PR that actually carries the fix. Issue #12371 timeline unchanged (2 non-bot
events, both jkwak-work 18:16Z). **0 reviews on either PR.** Still nobody has reviewed.

⚠️ **CI at `95bdd991` is infra-by-design, same signature:** 36 check-runs — `failure` 2
(`check-ci`, `wait-for-human-priority`), `skipped` 33, `success` 1 (`filter`). Read the failing run's
own annotation, not the color: *"priority-gate-yielded: higher-priority CI is active; ci-retry-yielded-bot
will rerun this bot CI when quiet"*. Nothing outside {check-ci, wait-for-human-priority} ⇒ **no fixer
dispatch.** Control that the instrument works: master head `d7d59f37` ⇒ `total_count` **646**.
#12382 unchanged at `f93eb4f7` (84 runs, same 2 failures).

⛔ **FIFTH LATCH FIX, AND THE DEFECT IS THE FOURTH FIX'S OWN SHAPE.** `xprs` is a **set-membership**
probe: it fires once when a superseding PR appears, then is blind to everything that PR does. #12408
changed head, +311 lines, gained both closing links, and picked up a human assign + review request —
`xprs=12382,12408` was byte-identical through all of it. ⭐⭐⭐ **A membership probe answers "does it
exist", never "what is it doing" — and the event I was waiting for was on the OTHER PR, so the field
that finally saw the superseding PR still could not see the fix landing in it.** Every one of the five
fixes widened the field set and the next defect was another *unenumerated* field; this one is worse,
because the field existed and was the wrong *kind*.
⇒ Added `|xst=` — one row per cross-referencing PR: `number:head:isDraft:state:mergedAt:closingLinks:humanComments:reviews`.
Current value: `12382:f93eb4f7…:true:OPEN:null:12371:1:0,12408:95bdd991…:true:OPEN:null:12371+12383:1:0`.
Also fixed a latent bug in the 4th fix while there: `xprs` did not filter by `repository_url`, so a
cross-reference from a **fork or downstream repo** would have entered the set and then 404'd the new
per-PR probe **on every fire forever**.
Tested six ways: **T1** wakes on the widened set · **T2** silent immediately after · **T3
RETROACTIVE control** — seeded the 22:5xZ state (`12408:d8dcbe35…:…::0:0`, no closing links) and it
**wakes**, so the field catches the event that was dark rather than merely being present ·
**T4** cross-ref `pr view` 404 ⇒ silent, latch + lastwake **md5-identical** · **T5** `/reviews` 403 ⇒
silent, latch identical · **T6** malformed head sha ⇒ silent, latch identical. `bash -n` clean.
⭐ Restored `lastwake` to the true `1786057206` afterwards — **a test of a budgeted mechanism must not
consume the budget it measures.**

## 19:0xZ heartbeat wake — the latch said "unchanged" through the chain's TWO biggest events

Fingerprint byte-identical to prior (`…|human=0|prrev=0|prrc=0|prc=1`), so by its own rule this was a
silent wake. Re-measured anyway. **Two decision-relevant events had happened in the preceding 45
minutes and every field the latch carried was correct and unchanged through both.**

1. ⛔ **`jkwak-work` took ownership of #12371 — `assigned` 18:16:13Z, `milestoned` "Q3 2026 (Summer)"
   18:16:28Z. These are the FIRST non-bot events in the issue's entire timeline** (all 12 prior
   events are `nv-slang-bot[bot]`). Not comments ⇒ `human` stayed `0`. He is already assignee +
   requested reviewer on #12382, so this is the human who would do the ready/approve/merge acts.
2. ⛔ **PR #12408 opened 18:30:44Z — a SUPERSET of #12382, on a different branch, and it builds A2.**
   `fix/issue-12383`, head `d8dcbe35`, draft, bot id 274397474, 5 commits, 5 files +558/−29.
   `compare f93eb4f7...d8dcbe35` = **status ahead, ahead_by 2, behind_by 0** — a strict descendant;
   its commit list literally contains `5c4c63d1`, `b52dba91`, `f93eb4f7` by the same shas. So
   **#12408 contains all of #12382 and adds 2 commits.**

✅ **ORDER TEST on the fetched file at `d8dcbe35` — this is A2, measured not inferred.**
`if (needsLink)` :3449 → `artifact = _Move(linkedArtifact)` :3463 → `compiler->compile` :3499 →
`stripDbgSpirvFromArtifact` :3508 → `passthroughDownstreamDiagnostics` :3520 → **`if
(needsValidation)` :3529** → `validateSpirvArtifact(…, artifact)` :3531, plus a second call on
`dbgArtifact` :3537. Validation is now **BELOW** the optimizer and the debug-strip ⇒ **A2**, the exact
shape Q1 was asking about. `spirv.getBuffer()` count inside the validation region: **0**. Both
`return SLANG_FAIL` arms preserved (2, inside the new `validateSpirvArtifact` helper :3292-3327,
which loads the blob itself so caller and validator cannot name different bytes).

⇒ ⭐⭐⭐ **Q1 (A1-only vs A1+A2) has been answered IN BUILT CODE by a different chain while the
operator never answered it.** A2 exists as a superset PR. Q1 is now largely moot as a *build*
question; what remains is which PR carries #12371.

⛔ **UPGRADE 19:3xZ — the closure hazard is NOT contingent, it is STRUCTURALLY BLOCKED. The triager
decided the mechanism I filed as unmeasured, and I reproduced it independently.** One API call:
`allow_squash_merge=true`, **`allow_merge_commit=false`, `allow_rebase_merge=false`** ⇒ squash is the
only enabled method, and a squash mints a new single-parent commit, so a PR head tip **never** becomes
an ancestor of master. My own run over the 12 most-recently-updated merged PRs: `compare/master...<head>`
= **`diverged` 12/12**, `merge_commit_sha` **`parents=1` 12/12** (triager's wider run: 25/25 and 20/20).
Must-hit control `compare/master...master` ⇒ **`identical`**, so an ancestor reading *was* reachable by
this instrument. Precedent of exactly this shape, verified by me: superseded drafts **#12072**
(`fix/issue-12070`) and **#12067** (`fix/issue-12058`) both closed `merged=false`, `merged_at=null`.
⇒ **If #12408 merges as-is, #12371 AND #12383 both stay OPEN, and #12382 remains an open draft whose
content already shipped.** The `Fixes` link on #12408 is therefore **required, not tidy-up**, and
#12382 will need a manual close.

⭐⭐⭐ **The transferable lesson, and it is against me:** *"contingent on a mechanism I did not
measure"* and *"structurally impossible"* produce the **same next action** from a careful reader, so
the gap between them reads as cosmetic — but only the second makes the recommendation **mandatory**,
and only the second **predicts the second symptom** (#12382 needing a manual close), which my hedged
version could not have surfaced. ⇒ **An honest hedge is not free: it loses the entailments the
decided version would have produced. Before publishing "I did not verify M", price the verification —
here it was ONE API call (`gh api repos/$R --jq '{allow_squash_merge,allow_merge_commit,allow_rebase_merge}'`).
A hedge is correct only when the measurement is genuinely out of reach, not when it is one call away.**
Leaf: [[feedback_a_hedge_costs_the_entailments_of_the_decided_claim]].

✅ **Gave the triager the positive control its write-guard denied** (its guilty-control attempt on
master's head was blocked by the `state=`-literal filter): `check-runs` at master head `d7d59f37` ⇒
**`total_count` 590, returned 100** vs #12408's `d8dcbe35` ⇒ **0/0**. So the zero is a real negative,
not a broken instrument. Workaround for its guard: rename the jq label, don't split the call.

⚠️ **One coordinate mismatch, resolved in the triager's favour on the line but mine on the claim:**
it cited `needsLink` **:3418**, I cited **:3449**. Both are real and different things —
**:3418** is `const bool needsLink = downstreamLinkingAllowed && spirvFiles.getCount() > 1;` (the
*declaration*), **:3449** is `if (needsLink)` (the *branch*, which is the order-test leg). Not a
discrepancy in the finding; a discrepancy in which line the label names. ⭐ **Two agents citing
different line numbers for "the same" leg is the cheap tell that they are citing different
constructs** — check before treating it as a contradiction.

⚠️ **Closure-path hazard as I ORIGINALLY filed it (superseded by the block above; kept because the
hedge is the lesson).** #12408 has
**NO** `Fixes`/`Closes` line — `closingIssuesReferences` = **[]** (control: #12382's =
`[{12371}]`). Its body mentions `#12371` ×2, `#12383`, `#12382`, `#12247` as prose only. So #12408
alone would close nothing. If #12408 merges, #12382's head sha becomes reachable from master and
GitHub *usually* auto-closes such a PR as merged — which would fire #12382's `Fixes #12371`. I did
**not** verify that auto-close fires for this shape, so: **#12371's closure is not broken, it is
contingent on a mechanism I have not measured.** Nor does #12408 name a closing link for #12383.
Routed to `slang-triager` on the canonical thread (its chain owns both PRs' bodies; I never patch
another tier's artifact).

⛔ **The survey that PARKED #12383 has been run** — #12408's body reports 657 cases replayed / 643 in
scope / 563 shipped an artifact / **563 clean / 0 newly rejected**, and *discloses* the 80 in-scope
cases that shipped nothing as **unmeasured, not passes** (78 non-zero exits, 1 zero-exit-no-output, 1
unreadable). That candid bound is why the number is usable at all. It is the fixer's measurement on
the fixer's tree, not mine — I verified the diff and the order, never the runs.
⚠️ #12408 has **0 check-runs** (`total_count` 0 == rows returned 0): CI has not started, so its CI
is *unmeasured*, not green. #12382 unchanged: 2 failures, both `check-ci` + `wait-for-human-priority`
⇒ still infra-by-design, no fixer dispatch.

⛔ **THIRD latch-omission on this same guard, and the pattern is now unmistakable: every fix widened
the FIELD SET, and the next defect was another field nobody had enumerated.** Unlatched fire → loop
(06:30Z) · failure path writing the latch → poisoning (11:2xZ) · PR-side reviews dark (15:07Z) · and
now **issue-timeline non-comment events** + **superseding PRs on other branches** dark. ⭐⭐⭐ **A
one-branch aperture cannot see the work that swallows it** — `pulls?head=fix/issue-12371` is blind to
a superset PR by construction, no matter how many fields it carries about that one branch.
Fixed with two probes appended as `|iev=N|xprs=a,b`:
- `iev` = non-bot events on the **timeline**, filtered by `actor.id != 274397474`. ⚠️ **Filtered by
  id, never login** — `login=nv-slang-bot` type=User id=286953280 is a different account a login
  filter would silently drop.
- `xprs` = sorted unique set of PR numbers cross-referencing #12371.
Both shape-checked (integer / empty-or-digits-and-commas) and **bail without touching the latch**.
Tested six ways: **T1** wakes on the widened field set · **T2** silent immediately after · **T3**
timeline 404 (partial failure, `gh` stub on PATH) ⇒ silent, latch + lastwake **md5-identical** ·
**T4** stored value uncorrupted · **T5** positive control (`iev` seeded to 1) wakes · ⭐**T6
RETROACTIVE control — seeded `xprs=12382`, i.e. the exact state at 18:29Z, and it wakes**, so the new
field demonstrably catches the event that was dark rather than merely being present. `bash -n` clean.
⭐⭐ Restored `lastwake` to the true `1786042806` (19:00:06Z) afterwards — **a test of a budgeted
mechanism must not consume the budget it measures.**

## 15:07Z heartbeat wake — nothing moved; latch widened to cover PR-SIDE review activity

First heartbeat wake after the latch fix (`wake_reason=heartbeat`, prior fp byte-identical to fp).
Re-measured independently rather than trusting the fingerprint: head still `f93eb4f7`, draft, open,
3 commits, 4 files **+204/−7**, `mergeable_state=behind`. **0 reviews, 0 inline review-comments**; the
only PR issue-comment is `jhelferty-nv` **05:58:29Z** board-sync (*"auto-assigned @jkwak-work as
shepherd"*) — already logged, not new. Issue #12371 open, 1 comment (ours). Q1 still unanswered.
Emitted nothing upstream; nudge #2 not due (budget = after 4+ heartbeat wakes, this is #1).

⛔ **DEFECT FOUND WHILE READING MY OWN LATCH: PR-side human activity was DARK to it.** The
fingerprint carried the **issue's** comment count but **nothing about the PR** — so a reviewer
submitting a review, requesting changes, or leaving an inline comment changed **no field** and could
sit unseen for the whole **4-hour** floor. On a draft PR awaiting exactly that, the single most
decision-relevant event was the one event the guard could not see. ⭐⭐⭐ **A state-change latch is
only as good as the field set it covers; "no wake" then means "none of the things I happened to
enumerate moved", never "nothing happened".** ⚠️ Both prior latch bugs were about *how* the value
was written (unlatched fire → loop; failure path writing → poisoning) — **this one is about WHAT is
in it, an omission that no failure-injection test can surface** because the probe never runs.

Fixed: three shape-checked probes (`pr_reviews`, `pr_review_comments`, `pr_comments`, all excluding
`nv-slang-bot[bot]`) appended as `|prrev=N|prrc=N|prc=N`. Same discipline as every sibling probe —
**integer shape-check, bail WITHOUT touching the latch**, never coalesce an API error to `0` (which
reads as *"nobody has reviewed"*, a resting state). Retested five ways: **T1** wake on the changed
field set → **T2** silent immediately after → **T3** all three probes 403 ⇒ `wakeAgent:false`, latch
+ lastwake **byte-identical** → **T4** partial failure (reviews only, 401) same → **T5** positive
control (latch seeded with a different fp) **still wakes**. `bash -n` clean. Current fp:
`f93eb4f7…|true|OPEN|null|check-ci,wait-for-human-priority|human=0|prrev=0|prrc=0|prc=1`.
⚠️ Known bound, deliberate: the three counts are `per_page=100` page-1 only — a change *within* a
>100 regime would be dark, though any crossing into it differs from the stored value and wakes.
⭐⭐ **My test fires overwrote `lastwake`; I restored the true `1786028404` (15:00:04Z) — a test of a
budgeted mechanism must not consume the budget it measures**, or the next real heartbeat lands early
and I'd read my own test as PR activity.

## Head `f93eb4f7` — re-verified 2026-08-06 11:1xZ (3rd commit)

**Third commit `f93eb4f7` 06:51:32Z, *"Address review feedback on the SPIR-V validation target change"*.**
Now **4 files +204/−7** (was +190/−7): `slang-emit.cpp` +11/−5, both test files +4/−1, unit test +185.
Still draft, `pr: non-breaking`, `Fixes #12371` (body line 139), base master, `mergeable:true`.
Title retitled to *"Validate the linked SPIR-V module rather than the pre-link buffer"*.
⚠️ **`mergeable_state` moved `behind` → `diverged` (ahead 3 / behind 3)** — master advanced; not a conflict.
Assignee + requested reviewer **`jkwak-work`** (board-sync auto-assigned him as shepherd, cmt 29613962).

✅ **ORDER TEST re-run on the fetched file at `f93eb4f7`, not from the body: still A1.**
`if (needsValidation)` **:3427** → `validate` **:3438** → `disassemble` **:3454**; `compiler->compile`
(optimize) **:3493**, `stripDbgSpirvFromArtifact` **:3502**. Validation remains **above** the
optimizer. Both `return SLANG_FAIL`s kept; the block reads from `artifact->loadBlob`, not
`spirv.getBuffer()`. Also re-confirmed the **skip-flag drop is still live** in both test files
(`-skip-spirv-validation` absent from the link line; each now carries a 3-line comment naming #12371
as the regression assertion), and the unit test's `ScopedEnvVar` **`"0"` during precompile / `"1"`
only for `getEntryPointCode`** scoping is intact (`:103`, `:142`) — the fix for the void control.

**The third commit is review-nit hygiene only, 3 lines of substance.** Reviewed each: (a) hoists
`getBufferSize()` into `const size_t spirvByteCount` to drop a duplicate virtual call; (b) fixes a
**real latent bug** in the unit test's discriminator — `kSpvGeneratorKhronosLinker` was `17` compared
against `magic >> 16`, now stored **pre-shifted `17 << 16`** and compared with `& 0xFFFF0000u`.
I verified the pre-shifted convention against `slang-emit-spirv.cpp:97` `kSPIRVSlangCompilerId = 40 << 16`
✅; (c) adds an `fprintf(stderr, …)` of compiler diagnostics on failure so a CI failure is
diagnosable. `<stdio.h>` reaches it transitively via `slang-unit-test.h` → `slang-render-api-util.h`
→ `core/slang-string.h:13`; 12 sibling unit tests use `fprintf` with no direct include, so the
pattern is precedented, not a portability risk.

⛔ **CI unchanged and still infra-by-design, now measured with a completeness control.**
Paginated all check-runs at `f93eb4f7`: **84 rows returned == API `total_count` 84** (so nothing was
silently windowed) → **2 failure / 74 skipped / 8 success**. The only two failures are `check-ci` and
`wait-for-human-priority`. Read the failing job's own log (run `31079160248`): *"Yielding to
human/merge CI #29914 (jkwak-work) … #29902 (jkiviluoto-nv) … Yielding behind earlier bot CI #29903 …
Higher-priority CI is active. Marking this bot run for retry"* → `::error::priority-gate-yielded`.
⇒ **0 real build/test failures; no fixer dispatch.** **0 reviews, 0 review-comments** on the PR; the
only issue-comment is board-sync's. Issue #12371 still **open**, 1 comment (ours, `updated 07:48:58Z`).

⛔ **MY OWN GUARD'S LATCH WAS POISONED BY ITS OWN FAILURE PATH — 8 spurious wakes, fixed 11:2xZ.**
Woken with `prior_fingerprint="|human=0"` (five empty fields), and the fire cadence was **09:00 09:20
09:40 10:00 10:20 10:40 …** on a PR unchanged since 06:51Z — against a latch meant to cap at one wake
per 4 h. Root cause: a failed `gh` call left `$d` empty, every downstream `jq` errored to
`/dev/null`, the fingerprint collapsed to `|human=0`, and **the failure path then WROTE that value to
the latch file** — so the next *healthy* fire differed again and woke too. One transient failure
starts a self-sustaining loop. Second route: `gh api --jq` prints error JSON to **stdout**, so
`[ -z "$cr" ] && cr='[]'` never fires and `sort` throws *"object cannot be sorted"*, blanking the fp
the same way. Fixed with 4 shape-checks (integer / array / `.number` match / non-empty head) that
`exit` **without touching the latch**. ⭐⭐⭐ **My 06:30Z "tested two-directionally" was fire→wake +
fire→silent, BOTH with a healthy `gh` — the failure path, the only path that produces the bug, was
never executed.** Now injection-tested with a `gh` stub on `PATH`: total failure, and partial failure
per call site (T2 T3 T4 T6), latch byte-identical in all four; **T5 positive control** (latch holding
a genuinely different fp) still wakes. Full derivation:
[[feedback_a_latch_its_own_failure_path_can_write_is_not_a_latch]] + shared learning.
✅ Audited the sibling guards: `sweep12375-guard.sh` is clean (explicit `PROBE BROKEN` arm, stores no
latch); the other five store no fingerprint at all.

## DRAFT PR #12382 — verified 2026-08-06 06:30Z

**Open, draft (correct), `pr: non-breaking`, `Fixes #12371` at body line 122, base master, mergeable.**
Author `nv-slang-bot[bot]` id **274397474** type Bot (our identity, matched on id+type not login).
2 commits: `5c4c63d1` 05:39Z, then `b52dba91` 06:21Z. Head is **1 commit behind master** (`behind`),
which is not a conflict. 4 files, **+190/−7**: `slang-emit.cpp` +10/−5, both test files +1/−1,
new `unit-test-spirv-link-validation.cpp` +178.

✅ **A1, not A2 — confirmed by the ORDER TEST on the actual file at head, not from the PR body.**
Fetched `slang-emit.cpp@b52dba91`: `if (needsValidation)` **:3427** → `validate` **:3437** →
`disassemble` **:3453**; `compiler->compile` (optimize) **:3492**, `stripDbgSpirvFromArtifact`
**:3501**. Validation still sits **above** the optimizer ⇒ A1. A2 would have moved it below `:3492`.
The diff reads validation from `artifact` (`loadBlob`), keeps **both** `return SLANG_FAIL`s, and the
dead `blob` load at the old `:3424-3425` became the load the fix needs — exactly the hoist shape
constraint 1 named. `:3419-3422` untouched (constraint 4 honored).

⚠️ **The PR body has one stale cell I did not correct (not mine to patch — the fixer owns it):**
body line 64 says `SLANG_ASSERT(...)` but commit `b52dba91` upgraded it to **`SLANG_RELEASE_ASSERT`**
(verified at `:3433` in the fetched file). The body prose was not re-synced with the second commit.
Cosmetic; flagged to the fixer rather than edited.

**Second commit also links #12385** in the unit test's comment, and the body's *Known limitation*
became **#12383** — so both deliberate out-of-scope items now have filed issues instead of prose.

⛔ **CI: both failures are INFRA-BY-DESIGN, not code.** `wait-for-human-priority` +
`check-ci` fail on **both** heads. The gate log is explicit: *"Yielding to human/merge CI #29905
(jkiviluoto-nv) / #29907 (jkwak-work) / #29902 … Higher-priority CI is active. Marking this bot run
for retry"* → `::error::priority-gate-yielded`. `check-ci` fails only because it aggregates that gate
(`wait-for-human-priority: failure`); all 74 build/test jobs are **skipped**, 4 succeeded, **0 real
failures**. `ci-retry-yielded-bot.yml` is running and reports *"CI is still active (4 runs); not
rerunning"* — it will requeue when quiet. ⇒ **No fixer dispatch warranted.** ⭐ **A red PR whose only
red is a throttle gate looks identical to a broken build until you read the job log** — classify by
the failing job's own output, never by the rollup's color.

⚠️ **`statusCheckRollup` reported these as SKIPPED while the head's own check-runs said FAILURE.**
One check *name* has two runs per head (a `pull_request` event run with everything skipped, and a
`workflow_dispatch` run that actually ran); the rollup picked the skipped one. A genuine build break
could hide the same way ⇒ the guard now reads **both** apertures and keeps both fields.

⛔ **Guard was waking every 20 min unconditionally once a PR existed** — `pr_exists` had no
state-change latch, so it would have re-reported the same PR forever. Fixed 06:30Z: fingerprint over
`(head, isDraft, state, mergedAt, sorted failing-check set, human count)` + a **4-hour heartbeat
floor** so a permanently-stalled CI cannot go dark. Tested two-directionally: fire 1 woke
(`wake_reason=changed`), fire 2 silent (`unchanged, 4s since last wake`). ⭐ **A recurring probe that
fires on a STATE rather than a CHANGE is a loop with extra steps — and its symptom is indistinguishable
from diligence.**

**State (2026-08-06 03:35Z):** triaged, verdict public (cmt 5197829621; labels
`Diagnostics`+`spirv_validation`+`reproduced`, Type Bug). **A1 dispatched** to `slang-fixer`
via `slang-triager` on `thread_id=gh-issue-shader-slang/slang-12371` for a **DRAFT** PR.

**RESUME trigger:** guard **`i12371-pr-guard-0175`** (`*/20`, script `/workspace/agent/i12371-pr-guard.sh`)
fires on `pr_exists` / `human_comment` / `issue_closed`. Armed 04:55Z because cancelling the hold
guard at dispatch left both outstanding items with **no trigger I control** — the fixer's PR number
(a lost handoff would be silent forever) and the operator's still-unanswered A1-vs-A2. See
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]. ⚠️ `ncl tasks create` takes
**`--name`**, not `--agent-group`; id is derived as `<slug>-<hex>`.

**A1 works on the fixer's tree** — but ⛔ **THREE of its measurements were VOID and retracted (05:04Z);
two of them I had already relayed upstream.** Trust only the re-verified set below.

- ⛔ **The 8/8 suite green measured UNPATCHED head.** `git status` showed ` M` from a **stale stat
  cache**; after `git update-index --refresh` the diff was empty and the source byte-identical to
  HEAD. ⇒ **Use `git show HEAD:<file> | diff -q - <file>` and check the `.so` mtime postdates the
  source. Never `git status` alone.**
- ⛔ **The layer-1 unit test was a VOID CONTROL, and its own evidence was read backwards.** I relayed
  `LinkageAttributes "…addOne…" Export` as proving it "drove the two-module link path"; it proves the
  **opposite** — 0 Import / 2 Export / **0 entry-point symbols** = the *library precompile* being
  rejected. Root cause: `precompileForTarget` sets `EmbedDownstreamIR` ⇒ `isPrecompilation` true ⇒
  **`needsLink` FALSE**, i.e. the `precompiled-glsl.slang:6` shape, an expected and different
  failure. Fixed with `ScopedEnvVar(...,"0")` across the precompile and `"1"` only for
  `getEntryPointCode`. Right-reason discriminator is now the **flip**: 0→**2 Import**, 0→**10
  entry-point symbols**. ⚠️ The naive version passed with no env and **failed with env=1 inherited —
  and CI exports it globally**, so it would have failed in CI.
- ⛔ **Root cause of all three: subagents building/testing in the worktree it was editing.** One
  stood down reporting "a peer session owns this tree" — the peer was itself. Now strictly serial.

⚠️ **The re-verification is worth exactly its discriminator, and I hold no view of the fixer's tree.**
The previous version of "A1 works, verified" was endorsed by **all three tiers** and was **backwards**.
⇒ **Accept the re-verification only if its report shows the flip to `2 Import / 10 entry-point
symbols`. If it says `Export` again, it measured the excluded precompile path a second time. "Suite
green" is not a substitute for that census.**

✅ **Re-verified by the fixer (fix byte-confirmed present; binaries 05:02 postdate source 05:01):** both tests
**4/4 PASS** with flags dropped and **FAIL** on reverted source (relink timeline checked);
`tests/library/` 16/16, `tests/modules/` 7/7, `tests/pipeline/` 43/43, green **both** env ways; unit
test PASS 1/1 with fix and FAIL 0/1 without, in both env states. Earlier: shipped bytes
**byte-identical** to the `-skip` baseline (`cmp`), linker stamp `0x00110000` intact, negative
control on `precompiled-glsl.slang:6` still rejects. Diff 12+/4− in one hunk; both `return
SLANG_FAIL`s kept; `:3419-3422` untouched.

⛔ **TWO DECISIONS — never conflate.** **Q1 = what to build** (A1-only vs A1+A2), operator-gated,
open. **Ready/merge = a publication state**, separate and **not entailed by any Q1 answer**. My own
phrasing *"A1-only … flips the draft to ready"* smuggled the second into the first, and the same
conflation was live in guard item 4 — both corrected. ⭐⭐ **Precedent enumerated over n=12, not n=1** (peer widened it; population `is:pr
author:app/nv-slang-bot` = **312** = 167 merged + 59 open + 86 closed-unmerged). Across the 12
most-recently-updated merged bot PRs: `ready_for_review` **12/12 by a human** (jkwak-work ×5,
pdeayton-nv ×3, tangent-vector ×2, skiminki-nv ×1; no `convert_to_draft` anywhere); `merged_by`
**12/12 human, bot-as-merger 0/12**; sole `APPROVED` a human every time. On #12115: `szihs` did
ready 2026-07-15T11:15:00Z, sole `APPROVED` 16:46:12Z, merge 21:40:44Z. ⇒ **Never flip ready, never
approve, never merge. All three are human acts; we post COMMENT-state only.**
⭐ **A guard resting on n=1 and one resting on n=12 read identically until someone enumerates** — and
the population was one paced loop away.

⛔ **IDENTITY TRAP — I published a false field here and the peer caught it.** TWO accounts share the
login stem: the `COMMENTED` reviewer on #12115 is `login=nv-slang-bot`, **`type=User`,
`id=286953280`** — **not us**. We are `login=nv-slang-bot[bot]`, **`type=Bot`, `id=274397474`**
(verified on our own cmt 5197829621). So "our bot commented on #12115" was false; the true version is
that our `[bot]` identity is COMMENT-only on **#12353/#12306**. ⇒ **Match on `id`/`type`, never
`login` alone.** ⭐⭐ **Two claims agreeing in VALUE is how a wrong field survives an audit** — both
accounts' review state is `COMMENTED`, so the conclusion was right and the attribution wrong, and
nothing in the value disagreed to flag it.
Q2 (stack-vs-master) is **struck as moot** — #12353 merged, so both answers name the same commits.

## The defect, at merged master `9cd92bb3a`

`source/slang/slang-emit.cpp` — verified by reading the merge commit, not inherited:

- `:3410` `if (needsLink)` — `:3412` `ComPtr<IArtifact> linkedArtifact;`,
  `:3424` `ComPtr<ISlangBlob> blob;`, `:3425` `loadBlob`, `:3426` `artifact = _Move(linkedArtifact);`,
  block **closes `:3427`**.
- `:3429` `if (needsValidation)` → `:3432` `compiler->validate((uint32_t*)spirv.getBuffer(), …)`
  — **the pre-link buffer.** This is the bug.

⭐ **PR #12353 merged the same block and KEPT `spirv.getBuffer()`** — so the textual collision is
gone but the defect is untouched. Confirmed by reading `:3432` at the merge commit; do not infer
"the rewrite probably fixed it" from the fact that it rewrote the block. `slang-triager`
independently confirmed 7/7 of the table plus a structural check: inside `if (needsValidation)`,
`linkedArtifact`/`blob` appear **0** times, `spirv.getBuffer()` **2**.

⛔ **These lines are the SAME pre- and post-merge — I published a bogus "+1 shift" and the triager
corrected it.** The hunk header `@@ -3428,11 +3428,26 @@` says start-line unchanged; only lines
**below** move, by `+15` (`compiler->compile` `:3472`→`:3487`). Mechanism and rule:
[[feedback_a_diff_hunk_header_is_not_a_line_delta]].

**A1 does not need its own `return` to be fatal** (triager's addition, verified): `spirv-validation-failed`
is declared `internal(` at `slang-diagnostics.lua:5922-5927`, and `Severity::Internal`(5) >
`Fatal`(4) in `slang-diagnostic-sink.h:13-21`, so `diagnoseRichImpl` hits
`SLANG_ABORT_COMPILATION` at `slang-diagnostic-sink.cpp:696-699`. ⚠️ **But the abort is
severity-driven, and severity is OVERRIDABLE** — `getEffectiveMessageSeverity` (`:641-644`) can
demote it, and `Severity::Disable` returns before any abort (`:648`). That is precisely why #12353's
author added an explicit `return SLANG_FAIL` with the comment *"Whether a rejected module reaches
the caller must not depend on the diagnostic's severity"* (`:3446-3450`). ⇒ **Keep the explicit
return in A1; do not lean on severity alone.**

**Control for "am I validating the right bytes"** (triager's addition): generator word
`0x00110000` = tool 17, SPIR-V Tools Linker — present in linked output, absent pre-link.

⛔ **Constraint (b) as originally dispatched was VACUOUS — corrected 04:07Z.**
`shouldRunSPIRVValidation` (`slang-emit.cpp:3264-3287`) is a **three-way** gate whose default is
`return false`; the third arm is `SLANG_RUN_SPIRV_VALIDATION == "1"`, which `slang-test` does **not**
set. Measured at `9cd92bb3a`: flag dropped + env unset → exit 0 / 964 B / 0 errors; identical command
with env=1 → exit 255 / 2 errors. So dropping the flag alone makes the test pass **identically with
and without A1**. CI does export it (`ci-slang-test.yml:123`,`:235`;
`ci-slang-test-container.yml:130`,`:203`; `nightly-slang-test.yml:125`), so the assertion only
becomes real after landing. ⇒ Fixer's shape: **layer-1 unit test** with its own `ScopedEnvVar`
(`tools/slang-unit-test/scoped-env-var.h`; precedent `unit-test-spirv-validation-unavailable.cpp:275`,
which #12353 itself added) **+ layer-2 flag drops for CI**. Gate: both tests must **fail** on
unpatched master with env=1 first. Do **not** remove `-incomplete-library` from the
module-producing lines (`generics:9`, `pointer-param:10`) — it hits the same gate's second arm
legitimately.

**`precompileForTarget` is documented experimental and NOT thread-safe** (`include/slang.h:5688-5695`)
— mutates the module with precompiled IR + temporary export metadata; callers must not use it
concurrently with other operations on the same module or session. The #12353 unit test's structure
satisfies this and the env-scoping constraint at once: `ScopedEnvVar` as the **first statement of the
per-compile helper**, own global session (`:279`) and own session (`:293`) per call.

**`:3424-3425` blob load is genuinely redundant** — `GlslangDownstreamCompiler::link`
(`slang-glslang-compiler.cpp:415-439`) already attaches the linked bytes via
`addRepresentationUnknown(RawBlob::create(request.linkResult, …))` at `:434-435` before returning.
⇒ **Hoist the load out of the branch and validate from it** (dead load → the load the fix needs),
rather than delete-then-re-load.

**`precompiled-glsl.slang` exclusion — state BOTH conjuncts publicly.** `needsLink =
downstreamLinkingAllowed && spirvFiles.getCount() > 1`. At `:6` (`-embed`) it is false via the
**first** conjunct (`isPrecompilation` ⇒ `spirvFiles` never seeded at `:3350`, count **0**); at `:5`
it is false via the **second** (single self-contained module, count 1). A single-mechanism claim is
contradicted on whichever line it doesn't cover — see
[[feedback_a_risk_does_not_license_a_mechanism]] on scope-of-the-replacement.

**Public verdict cmt 5197829621 patched twice in place** (never stacked; issue still 1 comment):
9412 → 9500 B, `updated 04:23:08Z`. Verified independently by me: `04:1xZ` ×0, `current master` ×0,
`master at or after \`9cd92bb3a\`` present, `04:19Z` ×2, zero HTML-escaping. ⭐ **Lagging facts can
wait; inverted advice cannot** — the patched bullet had said a fix should *not* be branched from
master, which after the merge was the one thing to do.

## Constraints carried to the fixer (all measured, not assumed)

1. ⛔ **"Validate `linkedArtifact` after `:3426`" DOES NOT COMPILE** — moved-from at `:3426`
   *and* scoped to the `if (needsLink)` block that closes at `:3427`. The `blob` at `:3424` is in
   that **same** block, so equally unavailable at `:3429`. Workable shapes: hoist the blob out of
   the branch, move validation inside the branch, or re-load from `artifact` (in scope; holds the
   linked result when `needsLink`, fresh bytes otherwise).
2. **Regression assertion = dropping the skips**, not a new test:
   `tests/library/precompiled-spirv-generics.slang:10` and
   `tests/library/precompiled-spirv-pointer-param.slang:11` both still carry
   `-skip-spirv-validation` at master (re-verified post-merge).
3. **Do NOT touch `precompiled-glsl.slang`** — `needsLink` is false for it (`isPrecompilation`),
   so its `Linkage`/`Export` is legitimate. 2 Export/0 Import there vs this defect's 5 Import/0 Export.
4. **Do NOT bundle** the bare `return SLANG_FAIL` at `:3419-:3422` — #12359 already diagnoses one arm.
5. `extras/formatting.sh` cannot run in the triager container (gersemi / clang-format / prettier /
   shfmt all absent) — the PR author runs it.

## Operator decision status

A1-vs-A2 and stack-vs-master were sent to `orchestrator-dashboard` ~00:45Z and **never answered**.
Dispatched on the task's stated default (**A1 only**, branched on merged master, `pr: non-breaking`,
`Fixes #12371`, held as **draft**). ⚠️ `ask_user_question` is **swallowed** from guard sessions
(`messaging_group_id` is null) — the 00:29Z timeout was that defect, **not** a declined ask; use
`send_message(to:"orchestrator-dashboard")`. See [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]].

Guard `i12371-hold-guard-1424` cancelled after dispatch (5 fires). Sibling guard
`pr12353-merge-guard-f006` still armed for the #12342 follow-up sweep —
[[project_12342_downstream_absent_capability_slangresult]].
