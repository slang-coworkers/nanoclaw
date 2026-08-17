---
title: "A draft PR is invisible to review queues — the issue gets re-triaged months later, and your 5-bullet does not prevent it"
type: learning
topic: agent-ops
source: learnings/1785978797257-a-draft-pr-is-invisible-to-review-queues-the-issue.md
---

# A draft PR is invisible to review queues — the issue gets re-triaged months later, and your 5-bullet does not prevent it

Measured on shader-slang/slang#11963 (2026-08-06), a re-triage request that arrived on an issue already
reproduced, root-caused and fixed a month earlier.

## The failure mode

Draft PR #11965 (`Closes #11963`, fix + guard-proven regression test) sat **30 days with ZERO review
activity**: `reviews=[]`, issue comments 0, review comments 0, `updated_at` frozen at the creation minute.
Then a MEMBER commented "Assigning to @X to triage" and reassigned the issue.

The diagnostic that explains it, and it is worth pulling deliberately:

```
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  isDraft reviewDecision
  timelineItems(last:10, itemTypes:[READY_FOR_REVIEW_EVENT,REVIEW_REQUESTED_EVENT,CONVERT_TO_DRAFT_EVENT]){nodes{__typename}}}}}'
```

Result: two `ReviewRequestedEvent` and **no `ReadyForReviewEvent`**. Requesting a reviewer on a *draft*
does not put it in a queue. So: reviewers requested, nobody notified in a way that acts, `Closes #N`
present but not prominent on the issue timeline ⇒ the issue reads as untriaged.

⭐**The part that matters for policy: the required 5-bullet issue comment WAS posted, on time, and it did
not prevent re-triage.** A public footprint makes work *auditable*; it does not make work *routed*. Those
are different jobs. When a chain's next step is a human decision, the comment must name the decision and
the person, not just record the state — and even then, a draft-held PR is a chain parked on a surface
nobody is scanning.

## Practical consequences

- On a draft-held chain, treat "the 5-bullet is posted" as necessary and NOT sufficient. Expect re-triage;
  the recovery move is a fresh comment that says *this needs a review/ready decision, not triage*.
- Post it FRESH when the last commenter is a human — an in-place edit notifies nobody, which is precisely
  the failure you are trying to fix.
- `reviewDecision: REVIEW_REQUIRED` + `isDraft: true` is a parked chain, not a chain in review.

## Re-verifying a month-old triage before you re-assert it

Every citation in a month-old comment is suspect. Mine had drifted:

- `visitLambdaExpr` moved `:7854` → `:7904`; `checkForRedeclaration` `:13765` → `:13842`. **Mechanism
  identical.** Publish the drift explicitly ("those are stale line numbers only") — otherwise a reader who
  checks the old cite concludes the diagnosis changed.
- Prefer naming the construct ("the global-scope `else` branch of `visitLambdaExpr`") over a bare line
  number when re-asserting old work.

Binary-freshness scoping that saved a rebuild-vs-claim mismatch: the Debug object was built 2026-08-04
while HEAD was 2026-08-05, i.e. nominally stale. But `git hash-object <file>` == `git rev-parse
origin/master:<file>`, and the file was last *modified* 10 days before the object was *compiled* ⇒ the
binary's copy of that code IS master's. Then scope the drift: `git log --since=<object mtime> --name-only
-- source/ include/ prelude/` returned 7 files, none on the path (non-zero control: 317 files repo-wide).
⇒ **stale-vs-fresh is not a property of a binary; it is a property of a binary WITH RESPECT TO A CLAIM.**

## Two instrument lessons

1. ⭐**`git merge-tree --write-tree` returning exit 0 with no CONFLICT is worthless until you have seen it
   report a conflict.** Guilty control: init a throwaway repo, two branches editing the same line, run the
   same command ⇒ exit 1 + `CONFLICT`. *Then* the clean result on the real PR means something. Same for
   `git apply --check` — and check `git status` afterwards, because `--3way` can leave the tree dirty.
   Also inspect the merged tree itself (`git show <tree-sha>:<file>`): "merges cleanly" does not tell you
   the change landed in the branch you intended.
2. ⚠**A behavioral freshness probe whose control also fails needs its output read, not its exit code.**
   Mine: semicolon-less `throw` rejected (`expected ';'` ×1) vs terminated form (×0) = the discriminator
   fired — but *both* exited 255, because my test shader's `IError` was undefined. Exit codes agreed while
   the measurement disagreed. Read the diagnostic text.
3. ⚠One void cell: `git show ... > file` ran from a non-repo cwd, so the file was never created; the probe
   then read a nonexistent path and reported "0 errors", which looks exactly like a pass. **A zero from a
   probe whose input was never created is not a measurement** — assert the input exists (`wc -c`) first.

## Cleanup detail that is easy to get wrong

`git apply`ing a PR diff **creates the PR's new test files as untracked**. When restoring, `git checkout --
<modified file>` is not enough; the added file is yours and must be removed, or you leave a
sibling session a phantom "pre-existing" untracked file. Distinguish what you created from what
pre-existed before deleting anything.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785978797257-a-draft-pr-is-invisible-to-review-queues-the-issue.md`_
