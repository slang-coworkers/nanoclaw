---
name: technique_scrub_a_checklist_issue_per_item_per_path
description: "Scrubbing a stale checklist issue: resolve each box independently AND name which code path satisfies it — a capability existing somewhere is not the same as existing on the path the issue names; checklist staleness runs in both directions"
metadata:
  node_type: memory
  type: technique
  originSessionId: main-slangpy-832-768-844
---

# Scrub a checklist issue per-item AND per-path

⛔⭐⭐⭐ **READ FIRST — THE CHECKBOXES WERE NEVER THE TRACKING SURFACE.** slangpy#768's parent body
has 4 unticked boxes; `GET /issues/<N>/sub_issues` returns **7 formal sub-issues**, and item 1's
(#819) is already **`closed/completed`**. The boxes are a *stale mirror*: PR #818 said `Fixes #819`
and never referenced the parent, so nothing propagated upward. ⇒ **On any checklist issue, call
`/issues/<N>/sub_issues` BEFORE reading the body — the body is a hand-maintained copy that no
merge updates.** A 0/4 report from the boxes and a 1/4-plus-3-extra-scope report from the sub-issues
are both "what the issue says"; only one is the project's own record.

⛔⭐⭐⭐ **AND THE OWNER SET IS NOT THE ASSIGNEE ON THE PARENT.** I stated twice, flatly and upstream,
that this gate had "no live decision-maker" — reasoning from the one departed assignee named in the
webhook. **Wrong: #820/#821 have been assigned to `ccummingsNV` since 2026-03-13, who is actively
merging** (#1081/#1082/#1075/#1085 merged 2026-07-31, #1086 open — and #1085 is the very PR whose
test underpinned the sibling #832 verdict). So 2 of the 4 items had a live owner the whole time, and
the ask was cheaper than I reported. ⇒ **ENUMERATE sub-issue assignees; never generalize
abandonment from the name you were handed.** Same error shape as trusting the checkboxes: a
convenient surface stood in for the authoritative one.

2026-08-05, slangpy#768 ("Support raw dispatch in slangpy", 4-item checklist, all boxes unticked,
parent assignee departed). The naive scrub reads the boxes and reports "0/4 done, still relevant." The
coworker's scrub found the checklist **stale in both directions** — and the discriminator was not
*whether* a capability exists but **which code path it exists on**:

- **Item 1 (thread count when dimensionality is 0): DONE**, in `calldata.py` — the path the issue
  actually names. Verified: `calldata.py:142` (`has_thread_count = "_thread_count" in kwargs`),
  `:266-272` (rejects `_thread_count` when `call_dimensionality > 0`). Landed **PR #818** (merged
  2026-03-05, *"Support _threadcount and float<N> for TensorView/DiffTensorview"*) — **a month
  after the issue opened**, which is exactly why it was never ticked.
- **Items 2-3 (call an entry point without a trampoline / generate a minimal wrapper): exist only
  in `dispatchdata.py`** (`:84-87`, `:100-135` — reads existing `entry_point`, else codegens a
  mini-kernel), which **predates the issue** (PR #263, merged 2025-06-06, 8 months prior). So they
  were never new work *there*, and are still **absent from `calldata.py`**, the path the issue asks
  to modify.
- **Item 4 (infer `[CUDAKernel]` on the backward pass from the forward): genuinely open.**
  `CUDAKernel` occurs **0 times in implementation code** — all hits are test/benchmark `.slang`,
  test `.py`, and one docs `.rst`. `dispatchdata.py` builds its `BindContext` with `CallMode.prim`
  only, so there is no backward path to tag.

⭐⭐⭐ **The rule: "is this capability implemented?" is the wrong question for a checklist issue.
Ask "is it implemented ON THE PATH THIS ISSUE NAMES?"** A capability present on the path the issue
says to *retire*, and absent from the path it says to *build*, reads as "done" to a
grep-for-the-feature scrub and as "not done" to a read-the-boxes scrub. **Both are wrong.**

⭐⭐ **The finding that reframed the issue:** the four items did not stall together — they split
across two paths, **and the path the issue calls "not well maintained, should be retired" is the one
that got invested in.** `.dispatch()` now carries **16 passing tests** across CUDA/Vulkan/Metal on
`main`. So the issue's own premise is the thing a maintainer has to rule on (retire vs. keep), and
that ruling gates the two sibling issues that defer to it.

⇒ **Procedure.** For each box: (1) name the concrete symbol/line that would satisfy it; (2) name
**which module** it lives in and whether that is the module the issue targets; (3) date the PR that
landed it and compare to the issue's `created_at` — a fix landing *after* the issue opened explains
an unticked box without implying absence; (4) for a "genuinely missing" verdict, grep and then
**partition the hits by implementation vs. test/benchmark/docs** (29 raw hits, 0 implementation, is
a *different* finding from 0 hits).

⚠️ **A lead I passed down did not survive checking — verify a lead before acting on it, and expect
your own to be refuted.** I suggested `test_override_threadgroup` passing was evidence for item 1.
It is not: it exercises `thread_group_size` — the `[numthreads]` **block** dims, on the
`.dispatch()` path (`test_raw_dispatch.py:120-128` → `.thread_group_size(uint3(1,1,1)).dispatch(...)`)
— whereas item 1 is the **grid** thread count on the calldata path, satisfied by `_thread_count`.
**Same word "thread", different knob, different path.** Related and genuinely useful for the
sibling issue #844: `dispatchdata.py:90-93` *refuses* `thread_group_size` when the entry point
already exists (`"Slang currently does not allow specifying thread_group_size for pre-existing
kernels."`) — a real constraint on that issue's configurable-thread-group ask.

⛔⭐⭐⭐ **A PR NUMBER SCRAPED FROM A COMMIT SUBJECT IS NOT A PR REFERENCE — and my "correction"
of it made a wrong fact look verified.** Full sequence, worth reading as one unit because the
error survived two rounds of checking:

1. The coworker's memo cited `dispatchdata.py` as *"PR #263, 2025-05-02"*.
2. I "corrected" it: `gh api …/pulls/263` returns **"Bake objects", merged 2025-06-06** ⇒ I told
   them the date was wrong and to use 2025-06-06. **This was worse than the original.** I had
   confirmed that *a* PR #263 exists and dated it — never that it touches the file.
3. They refuted me: **PR #263 touches `dispatchdata.py` in 0 of its 19 files** (verified). The
   commit that added the file is `842f6a93`, whose *subject* reads `slangpy merge (#263)` — and
   that `(#263)` is an upstream **sgl**-repo PR number that collided on the bare digits. slangpy
   imported its history from another repo, so subject-line PR numbers refer to the *other* repo.

⭐⭐⭐ **The trap: `gh api /pulls/<N>` ALWAYS resolves if any PR N exists, so "I looked it up and it's
real" feels like verification while checking nothing about the connection to the file.** The
discriminating query is **does PR N's file list contain the file** (`/pulls/N/files`), or better —
skip PR numbers entirely and cite the **commit SHA**. ⇒ **In a repo with imported history, treat a
`(#N)` in a commit subject as untrusted provenance.**

⚠️ **This is the second time in one chain that a CORRECTION carried the error** (the first:
[[feedback_a_ci_job_name_scan_is_blind_to_test_steps]]). The pattern is not coincidence — a
correction is *produced under time pressure to look responsive*, and its form asserts the checking
already happened, so it draws less scrutiny than the claim it replaces. **Budget more verification
for a correction than for an original claim, not less.**

✅ **What survived, stronger:** `842f6a93` (2025-05-02, ancestor of `main`) shows
`added slangpy/core/calldata.py` **and** `added slangpy/core/dispatchdata.py` — verified directly.
So the two paths were **born in the same commit**, eight months pre-issue: items 2-3 were never new
work, and there is no supersession story between the paths.
⚠️ Its "533 files / 164 pure adds" figures are **not confirmable** from `/commits/<sha>` — that
endpoint's `files` array **caps at 300** (reports exactly 300, 96 `added`). The cap makes a
truncated list look like a complete one; the load-bearing fact (both files `added` here) is visible
within the cap, so it holds regardless.

## The generator of every error in this chain

⭐⭐⭐ **Each failure was: CHECKING THE ARTIFACT YOU ASSUME SOMEONE CONSULTED, INSTEAD OF ASKING WHICH
ONE THEY DID.** Five instances, same shape, one chain:

| assumed surface | authoritative surface |
|---|---|
| CI **job names** | the **log line** naming the test |
| `gh api /pulls/N` (it resolves!) | `/pulls/N/files` — does it touch the file |
| a `(#N)` in a **commit subject** | the **commit SHA** (imported history ⇒ N is another repo's) |
| the parent body's **checkboxes** | `/issues/N/sub_issues` |
| the **one assignee** on the parent | the **assignee set** across sub-issues |
| `/commits/<sha>` `files` (caps at **300**, no truncation flag) | `git show --shortstat` on a clone |

⛔ **And on corrections specifically: THREE times here, the CORRECTION carried the error** (the CI
retraction; my PR-date "fix"; the 533→534 figure) — **and in two the corrector had MORE context than
the original author, not less.** Confidence scales with having *just looked*, which is exactly when
the looking was narrowest. ⇒ **Budget more verification for a correction than for an original claim.**

⚠️ **Scope a claim to the predicate that matters.** A peer cited `generator.py:768` as emitting
`[shader("compute")]` "unconditionally"; it is gated on `pipeline_type == PipelineType.compute`
(:767). The *conclusion* survived because nothing branches on whether the target is **already
tagged** — the property actually at issue — but "unconditional" is falsifiable in one grep and a
maintainer will run it. The grep-provable substitute is far stronger and I verified it:
**`calldata.py` never inspects `.entry_points` (0 hits); `dispatchdata.py` is the only place in the
codebase that does (1 hit, `:84-87`)**, while `calldata.py:518` always builds its own `compute_main`.
⇒ **Prefer the claim whose falsifier you have already run.**

⚠️ **Two destructive closes averted by checking instead of pattern-matching:** #807 reads as a dup of
the closed #819 (near-identical title) but is a sub-task of **#806** with strictly broader criteria.
And *"not well maintained and should be retired"* is **line 3 of the issue author's own body**, never
a ratified maintainer decision. ⇒ **Before closing as duplicate, diff ACCEPTANCE CRITERIA, not
titles; and check whether a directive quoted as policy was ever ratified by anyone but its author.**

⛔⭐⭐⭐ **READ THE COMMENTS, NOT JUST THE BODY — AND THE CONTRADICTING SOURCE MAY BE YOUR OWN PRIOR
COMMENT.** I twice asserted upstream that #807's 0-D tensor guard was a **live blocker**, citing
`tensor.cpp:410-411` (which *is* present on `main` — the code fact was right). **But our own
`nv-slang-bot` triage of #807, 2026-06-09 (comment `4660823599`), calls that guard "incidental — not
required for this feature" and lists lifting it as *optional* inside option B.** Verified by reading
it. So the *code* existed and the *significance* was invented — and the refutation had been sitting
on the issue for two months, authored by us.

That comment also reframes the issue's state entirely: it put **options A/B/C to @szihs** and is
awaiting their pick ⇒ #807 is **"awaiting a direction call from the reporter,"** not "untriaged" — a
materially different thing to hand a maintainer. ⇒ ⭐⭐⭐ **`/issues/N` returns the BODY; the state of
play lives in `/issues/N/comments`. Before characterizing any issue's status, read its comments —
and grep them for your own bot's prior verdict first,** because a stale self-contradiction is the
one error no peer can catch for you (they'd have to doubt your own published position). Note the
survival pattern: the conclusion *"don't close #807"* held, on **different grounds** — the unify /
semantics question, not a blocker. **Re-ground a conclusion when its premise dies; don't defend the
premise and don't drop the conclusion.**

Related: [[feedback_a_ci_job_name_scan_is_blind_to_test_steps]] (same chain — resolve at the
artifact, not the container listing).
