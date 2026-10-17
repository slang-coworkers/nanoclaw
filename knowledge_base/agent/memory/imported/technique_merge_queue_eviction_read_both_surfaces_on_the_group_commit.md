---
type: technique
name: technique_merge_queue_eviction_read_both_surfaces_on_the_group_commit
description: "Triaging a merge-queue eviction (`reason=failed_checks`): take the merge-group sha from `beforeCommit.oid` on the RemovedFromMergeQueueEvent (NEVER parse `gh-readonly-queue/<base>/pr-<N>-<SHA>` — that trailing sha is the already-green BASE), assert your probe target equals it, then read BOTH `commits/{sha}/status` and `check-runs` on it. Rule out a suspect with its `started_at` (began after the eviction ⇒ not the cause). Recovery is not zero cost: check the re-add's `actor` and `autoMergeRequest` — a failed_checks eviction consumes auto-merge, so no auto-requeue exists. Key the lookup on the PR number, not the job signature. Verified on slang#12328 / #12322."
metadata:
  node_type: memory
  type: technique
  originSessionId: main-2026-08-04
---

# Merge-queue eviction triage: right commit, both surfaces, real actor

**Main-verified on `shader-slang/slang#12328`, 2026-08-04/05.** The same wrong answer was derived
twice: once by me, and once by `slang-ci-babysitter` 90 minutes after it had refuted it itself.

## The case

#12328 was approved by `csyonghe` and its head was fully green. It was still evicted:

```
18:16:41Z  SlangPy Tests   commit STATUS = failure     ← THE EVICTOR (cross-repo legacy status)
18:17:12Z  removed_from_merge_queue (reason=failed_checks)
18:29:16Z  materialx-integration STARTS                ← 12 min AFTER the eviction
18:44:35Z  materialx-integration cancelled at 15.32 min (job ceiling = 15)
```

Three independent defects let a green reading stand.

1. **One surface.** All 55 check-runs were green (`total_count == returned`, no page cap). The
   evictor was a **commit status**, which is a different API. The queue's `failed_checks` verdict
   reads both surfaces. That rule is bidirectional and has its own leaf:
   [[feedback_check_runs_omit_legacy_commit_statuses]].
2. **Wrong commit.** The babysitter did read `status`, but only on PR head shas. The failure lives on
   the **merge-group commit**, which is nobody's PR head, so a head-only sweep never sees it. This
   hole recurs silently every sweep.
3. **A sufficient story.** "materialx cancelled at 15.32 min against a 15-min job ceiling" explains
   every visible byte, so nothing prompts another probe.

## ⛔ Get the merge-group sha from the event, never from the branch name

`gh-readonly-queue/<base>/pr-<N>-<SHA>` **ends in the BASE**. On #12328:

| source | sha | what it is |
|---|---|---|
| `beforeCommit.oid` (timeline) | `afb3aabe` | ✅ the merge-group commit |
| merge_group run `head_sha` | `afb3aabe` | ✅ same |
| sha inside `head_branch` | `5fc126c8` | ❌ the base, already-merged master |

The base is green by construction, so probing it returns an **affirmative all-clear**, not an
inconclusive one. Only `reason: "failed_checks"` contradicting that reading forced a re-probe, and
that was luck, not method.

Quote the base honestly. Paginated, it held 287 rows: 170 success, 96 skipped and **21 cancelled**.
Newest-per-name gives 71 distinct checks, and all 21 cancelled were superseded by a success under the
same name. The true figure is **"0 live failures across 71 distinct checks"**. "0 of 287" came from a
failure-only filter and fails its own spot-check.

```bash
# 1. The merge-group commit, by name:
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  timelineItems(last:20,itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT]){nodes{
    ... on RemovedFromMergeQueueEvent{ createdAt reason beforeCommit{oid} }}}}}}'
# 2. ASSERT probe target == beforeCommit.oid before reading any verdict.
# 3. Both surfaces on that sha:
gh api "repos/O/R/commits/<oid>/status" --jq '.state,(.statuses[]|"\(.state) \(.context)")'
gh api "repos/O/R/commits/<oid>/check-runs?per_page=100"
```

The assert is what makes this work on a PR nobody has seen. A warning about the branch name only
helps a reader who already suspects it.

## Cause vs consequence: use `started_at`

A job that **began** after the eviction cannot have caused it. `completed_at` cannot rule a job out,
because it is compatible with the job having started earlier. materialx started 12 minutes after the
eviction, so one comparison settles it. (The babysitter refined this, and it is strictly stronger.)

⚠️ The tell "a cancelled materialx job with all steps green lost no coverage" is not universal. Here
`Compile Shaders with slangc` was itself cancelled mid-step. Check step states before reusing it.

## ⛔ Recovery is not evidence of zero cost: check the actor

Both agents read #12328's re-add at 05:17Z as auto-requeue. The field neither of us had queried says
otherwise:

```
2026-08-04T17:59:43Z  AddedToMergeQueue      actor=skiminki-nv        (the author)
2026-08-04T18:17:12Z  RemovedFromMergeQueue  actor=github-merge-queue  reason=failed_checks
2026-08-05T05:17:25Z  AddedToMergeQueue      actor=skiminki-nv        ← the human author, 11 h later
mergeQueueEntry.enqueuer = skiminki-nv        autoMergeRequest = null
```

A `failed_checks` eviction **consumes the auto-merge**, so GitHub had no mechanism to requeue it. The
11 h gap was an overnight human wait. A remembered ~15 h constant from another mechanism lent false
corroboration. #12322 was identical: its auto-merge was cleared by the eviction, and it had no re-add
at all. A "hold, a timer is running" disposition would have waited on nothing. Evictions that "mostly
recover" **understate the toil**, because each re-add bills a human and shows up as work nowhere.

```bash
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  autoMergeRequest{enabledBy{login} enabledAt}
  mergeQueueEntry{position enqueuer{login}}
  timelineItems(last:30,itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT,ADDED_TO_MERGE_QUEUE_EVENT]){nodes{
    __typename ... on RemovedFromMergeQueueEvent{createdAt reason actor{login}}
    ... on AddedToMergeQueueEvent{createdAt actor{login}}}}}}}'
```

## Retrieval: key on the entity, not the signature

The babysitter's second wrong derivation happened with the correction loaded in this very file. It
looked up "what is a cancelled materialx job?", landed in a materialx note that is silent on #12328,
and stopped. "What evicted #12328?" hits immediately. Entity keys are unique. Signatures are shared
across causes, so a lookup on one can return a true but irrelevant answer
([[feedback_a_rule_that_doesnt_fire_is_a_retrieval_failure]]).

## Standing state

The materialx 15-min **job** ceiling (`ci-materialx-regression-test.yml:25`) is a real, separate
finding worth a maintainer ask; it has legitimately run 14.38 min (#12182). It did not evict #12328.

Related: [[feedback_filter_latest_returns_two_suites_per_sha]] ·
[[feedback_a_concurrency_eviction_deletes_its_victims_from_the_queue_you_search]] ·
[[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] ·
[[feedback_a_guard_can_be_inert_and_read_as_passing]] ·
[[project_12052_stranded_mergequeue_operator_escalation]]
