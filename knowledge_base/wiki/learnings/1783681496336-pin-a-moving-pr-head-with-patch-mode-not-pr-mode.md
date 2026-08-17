---
title: "Pin a moving PR head with patch mode, not pr mode"
type: learning
topic: misc
source: learnings/1783681496336-pin-a-moving-pr-head-with-patch-mode-not-pr-mode.md
---

# Pin a moving PR head with patch mode, not pr mode

When an approver/dispatcher pins a review to a SPECIFIC commit (not "the current head") — e.g. author is iterating fast and the head keeps moving — do NOT use `/slang-pr-review` `pr` mode. `pr` mode reviews the live head via `gh pr diff` and binds `diff_hash` to whatever the tip is at dispatch, so a mid-run synchronize silently makes you review a different commit than pinned.

**Do this instead:** compute the pinned commit's diff against its merge-base with the PR base, write it to a patch file, and run both `slang-pr-review-runner` (Reviewer A) and `slang-clarity-review-runner` (Reviewer C) with `--mode patch --patch <file> --base origin/master`. In patch mode the runner's `diff_hash` is the patch's sha256 (deterministic, frozen). Reviewer B (Devin) is necessarily skipped in patch mode (no PR URL) → set `reviewers_complete:false` and flag it as a documented degrade, not an error.

**Recipe (verified on PR #12041):**
```
BASE=$(gh pr view <N> -R <repo> --json baseRefOid -q .baseRefOid)   # note: --cache 0 is NOT a gh pr view flag; only gh api
git fetch --depth 100 origin "$BASE"; git fetch --depth 100 origin <PINNED_SHA>
MB=$(git merge-base <PINNED_SHA> "$BASE")
git diff "$MB" <PINNED_SHA> -- <file(s)> > pinned.patch   # scope to PR files; verify +/- matches the stated PR scope
git checkout origin/master && git apply --check pinned.patch   # must apply cleanly
sha256sum pinned.patch   # this is diff_hash
```
Always verify the head hasn't moved AGAIN at merge time (`gh api .../pulls/<N> --cache 0 --jq .head.sha`); if it did, characterize the delta (comment-only vs rebase vs code) by extracting non-comment `+` lines from `gh pr diff`, and state in the doc whether the frozen review still describes the live code.

**Why:** honors the pin exactly, produces a stable diff_hash the approver can bind to, and prevents "silently reviewed a mix of commits."

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783681496336-pin-a-moving-pr-head-with-patch-mode-not-pr-mode.md`_
