---
name: feedback_a_correction_on_the_epic_does_not_reach_the_child_issue
description: "Retracting a claim on the parent epic leaves the SAME claim standing on the child issue where the live owner reads it. Publish the correction on every artifact carrying the claim, not the one you were talking on."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9e01493f-5e77-4c29-b072-57531f5f77ab
---

# A correction posted on the epic does not reach the child issue

**2026-08-05, slangpy scrub fan-out (#768 epic + #820/#821/#822 sub-issues).** A coworker published a
crash localization on **#820** at 19:33 — *"the crash is at dispatch, after compile"* — plus a
mechanism hypothesis naming `warning[E38040]`. Both were later **self-refuted** by independent
replication. The retraction (Amendment 5) was published on **#768 only**.

Measured state at 21:5xZ:
- `#768` comment `5196679064` — carries the correction (6 amendments) ✅
- `#820` comment `5196414363` — `created_at == updated_at == 19:33:24`, **never edited**, still
  reads *"the crash is at dispatch, after compile."* ❌

⇒ ⭐⭐⭐ **The person who has to act on a finding reads it on THEIR issue, not on the epic.** #820's
assignee is **@ccummingsNV** (live, actively merging), and #820 is where the crash defect is
tracked. The epic's assignee is the departed @mkeshavaNV. So the corrected copy sat on the issue
nobody owns, and the wrong copy sat on the issue with the live owner. Amending the epic *felt* like
correcting the record because the epic is where the conversation was.

⇒ ⭐⭐ **Before considering a retraction published, enumerate every artifact carrying the retracted
claim and check each one's `updated_at`.** `created_at == updated_at` on a comment you believe you
corrected is the whole detection — one API field, no content reading. Same shape as
[[feedback_a_shared_name_merges_two_sessions_reports]]: the fix landed somewhere, so it read as
landed everywhere.

⇒ ⭐ **Corollary — a downstream judgement inherits the claim too.** #820's comment also deduped
against #1089/#1051/#639 *under the dispatch localization*. Per the chain's own Amendment 6 lesson
(a distinctness call is only valid under the localization it was made with), that dedup had to be
re-run — it survived on #768 for a **phase-independent** reason (backend spread: #1089 is
structurally Vulkan-only, `vkGetPipelineKeyKHR` has 0 hits under `external/slang-rhi/src/cuda/`).
The child issue carries neither the re-run nor the surviving reason.

## The structural half is verifiable without the GPU — which is why the gap was cheap to close

The author of the #820 comment had **no build and no GPU** (ran the released 0.43.1 wheel, no
`gdb`), so it could not re-run the crash. But the load-bearing part of the correction is **source
structure**, which I confirmed myself at `507b4cf1` in `slangpy/core/calldata.py`:

- `defer_target_compilation = bool(build_info.options.get("defer_target_compilation", True))` —
  **defaults to `True`**.
- `device.create_compute_pipeline(program, defer_target_compilation=..., ...)` sits **inside
  `_try_build_shader`**, called from `build()`.
- `calldata.py` **never inspects `module.entry_points`** to see if the target is already tagged —
  the only `entry_point` calls are the hardcoded `compute_main`/`raygen_main` and ray-tracing hit
  groups.

⇒ ⭐⭐ **The deferred-compile default is the trap that produced the wrong localization: it lets the
debug log print `Dispatching …` BEFORE the deferred compile faults. A log line was read as a
program counter.** Generalizes past this bug — see
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] for the same species of instrument error.
⇒ **"Which phase crashed" is not answerable from ordered log output when compilation is lazy.**
Force it eager (`options={"defer_target_compilation": False}`) before localizing.

## ⛔ THE MIRROR CASE — fixing it one-artifact-at-a-time just moves the staleness

**Same session, ~30 min later.** The triager posted the correction on #820 (`5197942798`, 22:07;
original `5196414363` verified intact, `updated_at` unchanged). While re-deriving it, they **tested a
caveat that had been published as untested** — and it came back the opposite of the guess:

| variant | attributes | result |
|---|---|---|
| `v_plain` | none | rc=0 |
| `v_cudakernel` | `[CUDAKernel]` + `[numthreads]` | **rc=0 — does NOT crash** |
| `v_full` | `[shader("compute")]` + `[numthreads]` | **rc=-11 SIGSEGV** |

So the trigger is **`[shader("compute")]` specifically, not "already tagged" generally.** But #768's
comments still read *"the `[CUDAKernel]`-tagged variant of Arm A was **not tested** — likely the same
collision"* (`5196679064`) and *"`[CUDAKernel]` variant untested"* (`5197116445`).

⇒ ⭐⭐⭐ **Patching the artifact that was stale made the OTHER artifact stale. Two artifacts carrying
one claim is not a copy problem, it's a synchronization problem — and per-artifact patching cannot
converge, it only relocates the divergence.** Note the failure inverted with the fix: first the child
was stale, then the parent. Nothing in the second round would have caught this, because the second
round's whole framing was "the child was the neglected one."

⇒ ⭐⭐ **Keep a claim → artifacts ledger for a fan-out, and update every row when the claim moves.**
Ask *"where else did I publish this?"*, never *"is this artifact current?"* — the latter is
answered locally and truthfully while the set stays inconsistent.

⇒ ⭐⭐⭐ **PRESENCE IS THE WRONG PREDICATE — SWEEP FOR ORDERING (the triager's refinement, and it beats
my version of the rule).** *"The claim appears on #768"* was true both before and after the fix; what
changed is whether the **correction is the last thing a reader sees**. So the sweep predicate is not
"does the stale claim appear here" but "**is the newest comment on this artifact the correction**". A
stale claim *below* a correction is acceptable; the reverse is the bug. Verified this way on both
issues after the second round (#768 → `5196679064`, `5197116445`, `5197987080`; #820 → `5197942798`;
no other issue in the 11-issue cluster carries the claim) — containment established **by query, not
recall**.

⇒ ⭐⭐ **Re-run the enumeration AFTER each correction, not once before.** "Enumerate every artifact"
still implies a single pass, and the whole failure here is that *fixing* one artifact is what created
the next stale one. The sweep is a post-condition of every write, not a planning step.

⛔ **Cost of the instrument that forced 4 comments across 2 issues: `5196679064` was edited 6× and its
`updated_at` (20:40) proves it — one PATCH had already nearly destroyed the body after a rate-limited
read returned empty.** ⇒ ⭐⭐ **Amend-in-place does not scale past a couple of revisions: each edit
risks the artifact a maintainer actually reads, and amendments buried in an already-amended comment
get scrolled past. Post a new comment and cross-link.**

⇒ ⭐⭐ **"Untested but likely X" is a prediction, and publishing it next to measured results borrows
their authority.** Here the prediction was **wrong in the direction that mattered**: it inflated the
defect from one tag to both, which is exactly the scope claim a maintainer would plan against. Prefer
testing the caveat over publishing it — and when you must publish it, never attach a guessed
direction. Sibling of [[feedback_a_reporters_framing_is_a_hypothesis_not_a_finding]].

## How to apply

1. When retracting a published claim, list every issue/PR/comment that repeats it; check
   `created_at` vs `updated_at` on each; correct the one with the **live owner** first.
   ⛔ Then re-check the ones you *just* corrected from — a fix propagates staleness backwards.
2. Route the correction to the coworker who **authored** that comment (closest-to-the-state), on the
   child issue's canonical thread — not to the epic's thread where the discussion happened.
3. Hand them the source-verifiable half explicitly when they lack the hardware to re-run the
   experimental half; otherwise they will refuse the correction for want of a repro they cannot build.
