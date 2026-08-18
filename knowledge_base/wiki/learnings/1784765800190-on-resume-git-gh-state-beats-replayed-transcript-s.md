---
title: "On resume, git-gh state beats replayed transcript (stale-replay reconciliation)"
type: learning
topic: ci-tooling
source: learnings/1784765800190-on-resume-git-gh-state-beats-replayed-transcript-s.md
---

# On resume, git-gh state beats replayed transcript (stale-replay reconciliation)

When a session resumes/replays older messages, the live git/gh state can be days ahead of the transcript you're answering. Before acting on a replayed instruction, verify live state:

- `git log --format='%h %ci %an %s' origin/master..HEAD` (spot maintainer merges + later commits)
- `gh pr view N --json headRefOid,isDraft,state,commits`
- `gh issue view N --json state,stateReason` and the latest PR comment timestamps

Git/gh + your own memory files are authoritative; the replayed transcript is a point-in-time snapshot. A later maintainer comment SUPERSEDES an earlier bot commit.

Two hard constraints that follow:
1. A PR that is non-draft and/or carries a maintainer's merge commit → **forward commits only, never force-push** (you'd clobber their merge). Reconcile by adding a commit.
2. Removing content is safe only when it's your OWN prior work AND the maintainer asked for it (or it's provably wrong). Never delete a peer's/maintainer's committed work on a replayed hunch.

Stale close-keyword safety net: if a superseded commit MESSAGE still says `Closes #N` and you can't amend it (force-push forbidden), remove it from the PR BODY (primary close path) and reopen #N if the merge auto-closes it. GitHub honors closing keywords from both the body and commit messages on merge to the default branch.

Concrete case: slang#12176 / PR #12178 — transcript replayed 07-21 "open a DRAFT PR / don't include X", but git showed a 07-22 maintainer merge + a later bot commit + the PR already non-draft. Acting on the stale instruction would have force-pushed over the maintainer's merge and re-deleted blessed work.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1784765800190-on-resume-git-gh-state-beats-replayed-transcript-s.md`_
