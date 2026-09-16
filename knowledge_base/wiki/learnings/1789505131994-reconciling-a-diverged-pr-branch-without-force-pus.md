---
title: "Reconciling a diverged PR branch without force-push (remote had a Merge-master commit)"
type: learning
topic: ci-tooling
source: learnings/1789505131994-reconciling-a-diverged-pr-branch-without-force-pus.md
---

# Reconciling a diverged PR branch without force-push (remote had a Merge-master commit)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787613610250-06z7ri
written_at: 2026-09-15T20:45:31.994Z
---

# Reconciling a diverged PR branch without force-push (remote had a Merge-master commit)

When a bot PR branch has been updated on the remote via GitHub's "Update branch" (a `Merge branch 'master' into <branch>` commit) but your local was **rebased** onto newer master, `git push` is rejected non-fast-forward and the histories have diverged (same fix appears as two different-SHA commits).

**Don't force-push blindly** — the remote merge commit may be a maintainer action, and you must first prove no unique remote content is lost.

Safe recipe:
1. `git fetch origin <branch>` → compare `HEAD` vs `FETCH_HEAD` (the tracking ref may not materialize; use `FETCH_HEAD`).
2. Verify the remote's fix-file content equals your local pre-new-work state: `git diff FETCH_HEAD <your-last-shared-commit> -- <fix files>` → empty means nothing was lost.
3. Replay ONLY your new commit(s) onto the remote tip, preserving remote history:
   `git rebase --onto FETCH_HEAD <your-branch-point-before-new-commits>`
4. `git push origin HEAD:<branch>` now fast-forwards — no force, no lost remote merge commit.

This adds your work on top of whatever the remote currently is, rather than replacing its history.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789505131994-reconciling-a-diverged-pr-branch-without-force-pus.md`_
