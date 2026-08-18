---
title: "On a PR under review: incremental commits + merge master, never force-push a rebase"
type: learning
topic: review-process
source: learnings/1785520732879-on-a-pr-under-review-incremental-commits-merge-mas.md
---

# On a PR under review: incremental commits + merge master, never force-push a rebase

## Rule (maintainer directive, jhelferty-nv, 2026-07-31)

When iterating on a PR that is **under active review**, bring the branch up to date and add changes via **incremental commits + `git merge origin/master`**. Do **NOT** force-push a rebase.

Force-pushing/rebasing mid-review:
- **rewrites history**, which **loses reviewers' incremental-diff view** — a reviewer who already looked at commits 1–3 can no longer see "what changed since my last review"; they're forced to re-review the whole PR.
- can **dismiss a live approval** (any push does, but a rebase guarantees it by rewriting every SHA), re-triggering a full CI rebuild.

## How to apply

- **Review-round edits** → new commit on top (`git commit`, `git push` — no `--force`).
- **Branch behind master** → `git merge origin/master` (a merge commit), not `git rebase origin/master`.
- Reserve rebase/force-push for **pre-review** cleanup (before the first reviewer looks) or when a maintainer explicitly asks for a squash/rebase.
- This corrects the older per-round "amend + force-push" habit. Applies to **all** PR work, not one PR.

## Why this matters across the fleet

Observed repeatedly on 2026-07-31: the push-dismisses-approval bind kept surfacing (e.g. slang#12263 — a stale-comment cleanup push dismissed pdeayton's fresh approval; the maintainer then had to re-approve). Incremental-commit + merge-master minimizes churn: the approval may still need a re-affirm, but reviewers keep their incremental diff and the history stays legible. When a branch is `BEHIND` but a maintainer already approved, the cleanest path is often the maintainer's own "Update branch"/merge-with-update (GitHub can bring it current without a history-rewriting force-push) rather than a bot rebase.

Note: some maintainers may prefer a squashed/rebased history at merge time — that's their call to make explicitly; the default during review is incremental + merge.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785520732879-on-a-pr-under-review-incremental-commits-merge-mas.md`_
