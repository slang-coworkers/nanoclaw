---
name: technique_merge_queue_eviction_read_both_surfaces_on_the_group_commit
description: "Triaging a merge-queue eviction: `reason=failed_checks` reads TWO independent APIs — `commits/{sha}/check-runs` AND `commits/{sha}/status` (legacy commit statuses, incl. cross-repo ones like `SlangPy Tests`). Query BOTH — the rule is BIDIRECTIONAL: check-runs miss statuses (gating, cross-repo), and `status` misses check-runs (ALL of Actions), so `status: success` can come from a lone `license/cla` while the build is still running and says NOTHING about CI. Also NAME the pending check rather than counting it — "1 of 14 pending" hides "the only platform that reproduces the bug hasn't reported". Query them on the MERGE-GROUP commit, which is nobody's PR head — so a head-only sweep never sees it. ⛔ GET THAT SHA FROM `beforeCommit.oid` ON THE RemovedFromMergeQueueEvent, NEVER by parsing the branch name: `gh-readonly-queue/<base>/pr-<N>-<SHA>` ends in the BASE (already-merged master; 0 LIVE failures across 71 distinct checks — do NOT quote as "0 of 287": the raw 287 rows include 21 cancelled + 96 skipped, all superseded), so probing it returns an AFFIRMATIVE all-clear rather than an inconclusive one. Assert your probe target == beforeCommit.oid. Discriminate cause from consequence with the job's `started_at`: a job that BEGAN after the eviction cannot have caused it. Verified on slang#12328 twice."
metadata:
  node_type: memory
  type: technique
  originSessionId: main-2026-08-04
---

**Main-verified on `shader-slang/slang#12328`, 2026-08-04, after the same wrong answer was derived
twice — once by me and once by `slang-ci-babysitter` 90 minutes after it had itself refuted it.**

## The case

#12328 (`csyonghe` APPROVED, head fully green) was evicted from the merge queue at 18:17:12Z. Both of
us initially cleared it, then both of us blamed the wrong job.

```
18:16:41Z  SlangPy Tests   commit STATUS = failure     ← THE EVICTOR
18:17:12Z  removed_from_merge_queue (reason=failed_checks)
18:29:16Z  materialx-integration STARTS                ← 12 min AFTER the eviction
18:44:35Z  materialx-integration cancelled at 15.32 min (job ceiling = 15)
```

## ⛔ Defect 1 — "zero failing checks" is a claim about ONE of TWO independent APIs

I reported #12328 clean on the strength of **all 55 check-runs green (49 success / 6 skipped, zero
failures)**, `total_count == returned` so no page cap. That measurement was *correct* and answered the
wrong question. GitHub has two separate surfaces:

| surface | endpoint | holds |
|---|---|---|
| check-runs | `commits/{sha}/check-runs` | GitHub Actions jobs (what a CI sweep usually reads) |
| **commit statuses** | **`commits/{sha}/status`** | **legacy statuses — `license/cla`, `CodeRabbit`, and CROSS-REPO ones like `SlangPy Tests`** |

**The merge queue's `failed_checks` verdict reads both.** So a tool reading only check-runs will
confidently clear a PR the queue is about to evict. ⭐⭐⭐**This is the sharpest instance of
correct-measurement-over-an-incomplete-surface in the store, because the thing being measured was a
gating decision** — sibling of `--agent-group` (inert flag) and `filter=latest` (multi-suite).

## ⛔ Defect 2 — the merge-group commit is nobody's PR head

The babysitter *did* fetch `commits/{sha}/status` — for **PR head shas only**. The failing status lives
on the **merge-group commit** `afb3aabe` (⚠️**note the branch is
`gh-readonly-queue/master/pr-12328-5fc126c8…` — that trailing `5fc126c8` is the BASE, a different
commit; see the correction below**), which is not any PR's head. So it was invisible on
*both* surfaces: right instrument, wrong commit. **This is a coverage hole that recurs silently every
sweep** — nothing about the output looks incomplete.

⛔⭐⭐⭐ **CORRECTED 2026-08-05 — MY OWN RECIPE HERE CARRIED THE BUG IT WARNS ABOUT.** The earlier version
said *"the merge-group commit `afb3aabe`, `gh-readonly-queue/master/pr-12328-5fc126c8…`"* — naming the
right sha while pointing at a branch that **ends in a different one**. Measured on #12328:

| source | sha | what it actually is |
|---|---|---|
| `beforeCommit.oid` (timeline) | `afb3aabe` | ✅ **the merge-group commit** — *"Require terminating semicolon… (#12328)"* |
| merge_group run `head_sha` | `afb3aabe` | ✅ same |
| the sha **inside `head_branch`** | `5fc126c8` | ❌ **THE BASE** — *"Update generated design docs (#12345)"* |

⇒ **`gh-readonly-queue/<base>/pr-<N>-<SHA>` ends in the BASE**, not the PR head and not the merge commit.
That base is **already-merged master, so it is green by construction.**

⛔**BUT DO NOT QUOTE THIS AS "0 of 287" — I did, and it is a tidy composite.** Fully paginated
(`total_count=287 == got=287`, 3 pages), the raw histogram is:

```
170 success · 96 skipped · 21 CANCELLED     (all 287 completed)
```

**21 are `cancelled`, a failure-class conclusion.** My "0 failures" came from a *failure-only* filter —
the exact defect this store already catalogues. What rescues the conclusion is the de-phantom rule:
newest-per-NAME collapses 287 rows to **71 distinct checks**, and Main-verified **all 21 cancelled are
superseded by a `success` under the same name** (21 of 21), with status `state=success`.

✅**Honest form, and it is STRONGER: "0 live failures across 71 distinct checks."** ⭐⭐**"0 of 287" drops
the 21 cancelled and 96 skipped and counts superseded re-runs as checks — so a reader who spot-checks the
raw histogram finds 21 non-successes and concludes the note is wrong, when it isn't.** A composite figure
that cannot survive its own spot-check is worse than a smaller true one.

⛔⭐⭐⭐**So probing it does not read as inconclusive — it reads as an AFFIRMATIVE all-clear**, and every
downstream check passes. Nastier than the phantom-green case: there, repagination was the discipline that
caught it; here **the only thing that forced a re-probe was `reason: "failed_checks"` contradicting the
green reading.** Absent that one volunteered field, #12328 closes unexplained. ⚠️**That was luck, not
method.**

✅ **Self-verifying recipe — key on the OBJECT, and assert it:**
```bash
# 1. Ask GitHub for the merge-group commit by name; do NOT parse it out of a branch.
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  timelineItems(last:20,itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT]){nodes{
    ... on RemovedFromMergeQueueEvent{ createdAt reason beforeCommit{oid} }}}}}}'

# 2. ASSERT your probe target equals beforeCommit.oid before reading any verdict.
# 3. Then read BOTH surfaces on that sha:
gh api "repos/O/R/commits/<oid>/status"               --jq '.state,(.statuses[]|"\(.state) \(.context)")'
gh api "repos/O/R/commits/<oid>/check-runs?per_page=100"
```
⭐⭐**The assert is what makes this fire on a PR number nobody has seen** — a warning against the branch
name only helps a reader who already suspects the branch name.

## ⛔⭐⭐⭐ RECOVERY IS NOT EVIDENCE OF ZERO COST — CHECK THE **ACTOR** BEFORE CALLING AN EVICTION A NON-EVENT

#12328 was re-added to the queue at 05:17Z and both agents read it as *self-resolved / cleared without a
human*. I was one message from publishing a narrowed rule — *"GitHub does auto-requeue, just slowly (~15h)"*.
**Both wrong.** The field neither of us had queried settles it (Main-verified):

```
2026-08-04T17:59:43Z  AddedToMergeQueue      actor=skiminki-nv        (the author)
2026-08-04T18:17:12Z  RemovedFromMergeQueue  actor=github-merge-queue  reason=failed_checks
2026-08-05T05:17:25Z  AddedToMergeQueue      actor=skiminki-nv     ← THE HUMAN AUTHOR, 11h later
mergeQueueEntry.enqueuer = skiminki-nv        autoMergeRequest = null
```

⛔**And there was no mechanism by which GitHub COULD have requeued it:** the `failed_checks` eviction
**consumes the auto-merge** (enabled 08-03T15:07:45Z), and nobody re-enabled it. The 11h was an overnight
**human** wait, not auto-requeue latency.

⇒ ✅**Same picture on #12322, verified identically:** auto-merge enabled 08-04T13:35:27Z by
`jvepsalainen-nv`, cleared by the 00:09:14Z eviction, now `autoMergeRequest: null` **and no re-add event at
all.** **No auto-requeue is coming.** A "hold, a timer is running" disposition would have been waiting on a
mechanism that does not exist.

⭐⭐⭐**Why it fooled both of us: eviction → re-add with no bot action in between LOOKS self-healing, and the
gap landed plausibly inside a ~15h window our own notes document.** A remembered constant lent false
corroboration to an unmeasured claim — **the number was real but measured for a different mechanism.**
Same shape as the hex-needle two hours earlier: **fluency supplied a confident answer where a field lookup
was needed.**

⇒ ⭐⭐⭐**RECOVERY IS NOT EVIDENCE OF ZERO COST.** An eviction that appears to self-heal still bills a manual
re-add; it is only invisible because nobody read the **enqueuer**. ⚠️**Consequence for any cost framing: an
"evictions mostly recover" reading systematically UNDERSTATES the toil** — #12328 billed one human re-add,
#12322 will bill another, and neither shows up as work anywhere.

✅**Recipe — the actor is one query:**
```bash
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  autoMergeRequest{enabledBy{login} enabledAt}
  mergeQueueEntry{position enqueuer{login}}
  timelineItems(last:30,itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT,ADDED_TO_MERGE_QUEUE_EVENT]){nodes{
    __typename ... on RemovedFromMergeQueueEvent{createdAt reason actor{login}}
    ... on AddedToMergeQueueEvent{createdAt actor{login}}}}}}}'
```
**`actor` on the add event distinguishes `github-merge-queue` from a human; `autoMergeRequest: null` tells
you no automatic path exists.**

## ⛔⭐⭐⭐ The SAME two-surface rule cuts the OTHER WAY — and I'd only ever stated one direction

This file was written because **check-runs alone missed a commit STATUS** that evicted a PR. The inverse
is equally real and I had not recorded it. Measured on slangpy#1073 head `09ac1d91`, 2026-08-05:

```
commits/09ac1d91/status      → state="success", total_count=1   ← the ONLY status is license/cla
commits/09ac1d91/check-runs  → total=14, 1 still in_progress    ← every build/test job lives HERE
```

⇒ ⛔**`commits/{sha}/status` can read `success` and say NOTHING about whether the build passed** — the 14
build/test jobs are check-runs and **do not appear on that surface at all**. So *"commit status green"* is
not a statement about CI. **I cited exactly that phrasing to an operator as evidence a PR was green.**

⭐⭐⭐**The rule is bidirectional and neither direction is optional: check-runs miss statuses (gating,
cross-repo); statuses miss check-runs (all of Actions). Query BOTH, and never let either stand for "CI".**

### ⭐⭐ And WHICH pending check it is changes the meaning

The single unsettled job was `build (windows, x86_64, msvc, Debug, 3.10)` — **the exact platform where
the bug under test (`test_profiler.cpp:511`) reproduces.** ⇒ *"1 of 14 pending"* and *"the only platform
that reproduces the bug hasn't reported"* are **different facts**, and the count hides the second.
**Name the pending check, never just count it** — a pending list is not interchangeable by row.

## ⛔ Defect 3 — a sufficient story, and the discriminator that kills it

`materialx cancelled at 15.32 min against a 15-min job ceiling` explains a cancel, a genuinely lost
step, and a queue problem — every visible byte. There is no residual anomaly to prompt another probe,
which is why it won **twice**.

✅ **Use `started_at`, not `completed_at`** (the babysitter's refinement, and it is strictly stronger):
**a job that BEGAN after the event cannot have caused the event.** `completed_at` only tells you the
job finished later, which is compatible with it having started earlier and caused the failure.
materialx *started* 12 min after the eviction — one comparison, no ambiguity.

## ⭐⭐⭐ The retrieval lesson (babysitter's, and the most transferable part)

Its second wrong derivation was **not** a correction failing to reach the session — the correction was
loaded, in the file *and* its index line. It **keyed the lookup on the JOB SIGNATURE** (*"what is a
cancelled materialx job?"*) and landed in a materialx file that is silent on #12328, then stopped.
Asking *"what evicted #12328?"* hits the right entry immediately.

⇒ ⭐⭐⭐**Key root-cause lookups on the ENTITY (PR/issue number), never on the symptom's signature.**
Entity keys are unique; signatures are shared across unrelated causes, so a signature lookup can
return a **true but irrelevant** answer and read as success.

⇒ ⭐⭐⭐**A fresh derivation is not privileged over a stored conclusion by being fresh — it may simply be
missing the retrieval the stored one already did.** Corollary for a file that answers a *signature*
question: open it with a stop-block redirecting the entity question, so the wrong retrieval path
self-corrects instead of dead-ending in a true answer to a question nobody asked.

## ⚠️ Adjacent: the "cancelled with all steps green" tell is NOT universal

A stored tell said a `cancelled` materialx job with green steps means only the verdict was lost, no
coverage lost. On this run **`Compile Shaders with slangc` was itself cancelled mid-step**, so coverage
genuinely was lost. Two forms exist; check the step states before reusing the reassurance.

## Standing state

The materialx 15-min **job**-scoped ceiling (`ci-materialx-regression-test.yml:25`) is a real, separate
finding worth a maintainer ask — it has legitimately run at 14.38 min (#12182). It just did not evict
#12328. **Two real defects on one commit, and the later one absorbed the earlier one's causal role.**

Related: [[feedback_filter_latest_returns_two_suites_per_sha]] ·
[[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] ·
[[feedback_a_guard_can_be_inert_and_read_as_passing]] ·
[[project_12052_stranded_mergequeue_operator_escalation]]
