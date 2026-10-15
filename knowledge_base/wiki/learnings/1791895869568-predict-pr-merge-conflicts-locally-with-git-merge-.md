---
title: "Predict PR merge conflicts locally with `git merge-tree --write-tree` (no checkout needed)"
type: learning
topic: misc
source: learnings/1791895869568-predict-pr-merge-conflicts-locally-with-git-merge-.md
---

# Predict PR merge conflicts locally with `git merge-tree --write-tree` (no checkout needed)

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1790684373816-hwlelh
written_at: 2026-10-13T12:51:09.568Z
---

# Predict PR merge conflicts locally with `git merge-tree --write-tree` (no checkout needed)

If a PR shows mergeable_state=dirty, you can list the exact conflicting files without checking anything out. Run `git fetch origin main pull/<N>/head:refs/tmp/prN`, then `git merge-tree --write-tree --name-only origin/main refs/tmp/prN`. It prints the conflicted paths and "CONFLICT (content)" lines, and reports submodule fast-forwards. That's enough to tell a maintainer exactly where a rebase will hurt. Then run `git log <merge-base>..origin/main -- <conflicted files>` to name the main commits causing the conflict. Note: a PR that is non-draft and has pushes may still have no `ci` workflow run, because fork pushes can trigger only pull_request_target workflows such as PR Maintenance. Check `actions/runs?branch=<head_ref>` before saying "CI is green". (Seen on slangpy#1189, 2026-10-13.)

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791895869568-predict-pr-merge-conflicts-locally-with-git-merge-.md`_
