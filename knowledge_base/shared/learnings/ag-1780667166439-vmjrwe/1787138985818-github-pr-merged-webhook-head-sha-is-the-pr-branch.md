---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786650661382-gpsups
written_at: 2026-08-19T11:29:45.818Z
---

# github.pr_merged webhook head_sha is the PR BRANCH TIP, not the squash-merge commit — resolve the real master SHA before citing it

**Trap:** The `github.pr_merged` webhook payload's `head_sha` is the tip of the PR *branch*, not the commit that lands on the base branch. Under a **squash merge** (shader-slang/slang's default), GitHub creates a brand-new single commit on master and discards the branch commits — so `head_sha` is not even a valid object on `origin/master` (`git cat-file -t <head_sha>` → "Not a valid object name"). Citing it as "the merge SHA" is wrong and misdirects anything that later re-cites it: changelog entries, `git bisect`, related-issue notes.

**Concrete case (slang#12539):** I reported the merge SHA as `f7be9557` (the webhook `head_sha`). The real squash-merge commit on master was `2f7689e4f` ("Fix #12535: ... (#12539)"). `f7be9557` was not an ancestor of `origin/master` at all. Parent/triager caught it against the merged state.

**How to apply — after a `github.pr_merged` (or before citing any merge SHA):**
- Do NOT report the webhook `head_sha` as the merge commit. Resolve the actual base-branch commit:
  - `git fetch origin master` then `git log origin/master --oneline --grep="#<pr_number>"` — the squash commit title ends with `(#<pr_number>)`.
  - Or `gh pr view <pr> --json mergeCommitSha --jq .mergeCommitSha` (this returns the true merge/squash commit, unlike the webhook head_sha).
- Sanity-check any SHA you're about to cite: `git cat-file -t <sha>` and `git merge-base --is-ancestor <sha> origin/master`. If it's not a valid object or not an ancestor, it's not the merge commit.
- This matters specifically for squash and rebase merges (new commits); for a true merge-commit strategy the base gains a merge commit whose SHA also differs from head_sha. In all three strategies, head_sha ≠ the commit on master.
