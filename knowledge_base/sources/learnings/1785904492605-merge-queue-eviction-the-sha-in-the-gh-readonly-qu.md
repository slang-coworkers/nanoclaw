# Merge-queue eviction: the sha in the gh-readonly-queue branch name is the BASE, not the merge commit — probe beforeCommit.oid

## The `gh-readonly-queue/...-<sha>` trailing sha is the BASE — probing it is a confident false negative

**Refines an earlier note of mine** that said only "query both surfaces on the merge-group commit." True but
underspecified: it doesn't say *which sha that is*, and the obvious reading is wrong.

A merge-group `head_branch` looks like:

```
gh-readonly-queue/master/pr-12328-5fc126c8fceb1f7486914f972f912f01226851f1
```

**That trailing sha is the base the queue branched from — not the PR head, and not the merge-group
commit.** Measured on shader-slang/slang #12328 (2026-08-05):

| source | value | what it actually is |
|---|---|---|
| `RemovedFromMergeQueueEvent.beforeCommit.oid` | `afb3aabe` | ✅ the merge-group commit (authoritative) |
| merge-group run `.head_sha` | `afb3aabe` | ✅ same commit — *"Require terminating semicolon in throw statements (#12328)"* |
| sha inside `head_branch` | `5fc126c8` | ❌ the BASE — *"Update generated design docs (#12345)"*, a different PR |

Because the base is already-merged master, it is **green by construction**. Query it and both
`commits/{sha}/check-runs` and `commits/{sha}/status` come back clean, which reads as *"nothing was failing
before the eviction"* — a **confident false negative**. The instrument was right; only the object was wrong.
That's the failure mode that survives review, because a clean result retires the question and nothing looks
anomalous.

**What saved it here was a residual anomaly, not diligence:** GraphQL reported
`RemovedFromMergeQueueEvent.reason = "failed_checks"`, which contradicted the green reading and forced a
re-probe onto `afb3aabe` — where the real evictor sat, a cross-repo `SlangPy Tests` **commit status** failing
31s before the eviction. Had `reason` been absent I'd have closed it as unexplained.

**How to apply — make it self-checking:**

```bash
# 1. authoritative merge-group commit, straight from the eviction event
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  timelineItems(last:5,itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT]){
    nodes{... on RemovedFromMergeQueueEvent{createdAt reason beforeCommit{oid}}}}}}}'

# 2. assert your probe target == that oid, THEN query both surfaces on it
gh api -X GET "repos/O/R/commits/$MG/check-runs" -f per_page=100   # paginate to total_count
gh api -X GET "repos/O/R/commits/$MG/status"     -f per_page=100   # independent surface
```

Two further traps on that same commit: `check-runs` there can exceed one page (paginate until
`got == total_count`), and any job whose `started_at` **postdates** the eviction is a teardown consequence,
never the cause.

**Generalizable shape:** when an identifier is *embedded in a human-readable name*, treat it as a label, not
a key — ask the API for the key. A name-derived id that happens to resolve to a real, green object is the
most durable kind of wrong answer, because every downstream check passes.
