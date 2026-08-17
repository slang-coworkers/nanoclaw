---
title: "Bot can't update a stale PR branch when master changed .github/workflows (App lacks workflows perm)"
type: learning
topic: misc
source: learnings/1780567931645-bot-can-t-update-a-stale-pr-branch-when-master-cha.md
---

# Bot can't update a stale PR branch when master changed .github/workflows (App lacks workflows perm)

**Finding (2026-06-04, PR #11265 / issue #10528):** The `nv-slang-bot` GitHub App lacks the `workflows` write permission. When you bring a stale PR branch up to date with master — by **rebase OR merge, doesn't matter** — the branch's tree picks up master's own changes to `.github/workflows/*`. The push is then rejected:

`! [remote rejected] ... refusing to allow a GitHub App to ... update workflow .github/workflows/<x>.yml without `workflows` permission`

This is a **ref-tip-tree check**, not per-commit: GitHub compares the branch's OLD tip workflow files vs the NEW tip's. Even though your own commits touch zero workflow files, if master changed any workflow between the branch's old base and current master, the bot can't push the update. On #11265 this was **11 workflow files** changed by master.

**Do NOT work around it by stripping/reverting the workflow files to match the old tip** — that makes the PR's eventual **squash-merge silently revert master's workflow changes**. Confirmed harmful; codex agreed (patch-id of the workflow delta proves they're base-only updates, not PR-authored).

**Unblock paths (operator/human required):**
- **A. Grant the App `workflows` (Actions: write) permission** → retry `git push --force-with-lease` instantly. Fixes all future stale-PR updates too.
- **B. The fork owner / a human pushes it** — hand them a `git format-patch origin/master..HEAD` of just the PR-own commits (no workflow changes) + the rebase recipe; their *user* creds can push workflow files to their own fork (the restriction is App/Actions-token-only, not users with repo write).
- **C. GitHub "Update branch" button** — performs a base-*merge* under the clicker's auth (works), but it's a merge + merge-commit, not a rebase.

**Squash-merge rebase gotcha (same PR):** shader-slang/slang squash-merges, so a long-lived branch's true merge-base with current master is ancient (here `origin/master..PRE` = 6241 commits). NEVER `git rebase origin/master` such a branch — use `git rebase --onto origin/master <parent-of-your-first-own-commit>` to replay only your own commits. Verify faithfulness by diffing the rebased `origin/master..HEAD` against the original PR diff (file/status set + patch-id must match).

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780567931645-bot-can-t-update-a-stale-pr-branch-when-master-cha.md`_
