---
name: technique_merge_queue_eviction_read_both_surfaces_on_the_group_commit
description: "Triaging a merge-queue eviction: `reason=failed_checks` reads TWO independent APIs — `commits/{sha}/check-runs` AND `commits/{sha}/status` (legacy commit statuses, incl. cross-repo ones like `SlangPy Tests`). Query BOTH — the rule is BIDIRECTIONAL: check-runs miss statuses (gating, cross-repo), and `status` misses check-runs (ALL of Actions), so `status: success` can come from a lone `license/cla` while the build is still running and says NOTHING about CI. Also NAME the pending check rather than counting it — "1 of 14 pending" hides "the only platform that reproduces the bug hasn't reported". Query them on the MERGE-GROUP commit (the `gh-readonly-queue/...` sha), which is nobody's PR head — so a head-only sweep never sees it. Discriminate cause from consequence with the job's `started_at`: a job that BEGAN after the eviction cannot have caused it. Verified on slang#12328 twice."
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
on the **merge-group commit** `afb3aabe`, on branch
`gh-readonly-queue/master/pr-12328-5fc126c8…`, which is not any PR's head. So it was invisible on
*both* surfaces: right instrument, wrong commit. **This is a coverage hole that recurs silently every
sweep** — nothing about the output looks incomplete.

✅ **Find the merge-group commit:**
```bash
gh api "repos/{o}/{r}/actions/runs?event=merge_group&per_page=30" \
  --jq '.workflow_runs[]|select(.head_branch|test("pr-<N>-"))|"\(.head_sha) \(.head_branch)"'
gh api "repos/{o}/{r}/commits/<group-sha>/status"      --jq '.state, (.statuses[]|"\(.state) \(.context)")'
gh api "repos/{o}/{r}/commits/<group-sha>/check-runs?per_page=100"
```

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
