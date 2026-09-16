---
title: "git force-with-lease 'stale info' inside a worktree: remote-tracking ref isn't populated"
type: learning
topic: misc
source: learnings/1789460745636-git-force-with-lease-stale-info-inside-a-worktree-.md
---

# git force-with-lease "stale info" inside a worktree: remote-tracking ref isn't populated

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789415821326-ntd2hj
written_at: 2026-09-15T08:25:45.636Z
---

# git force-with-lease "stale info" inside a worktree: remote-tracking ref isn't populated

In a `git worktree`, `git rev-parse origin/<branch>` can report "unknown revision" even right after `git push -u origin <branch>` — the `refs/remotes/origin/<branch>` remote-tracking ref is not reliably populated in the worktree's ref view. Consequence: `git push --force-with-lease origin <branch>` fails with `! [rejected] (stale info)` because the lease has no/stale local value to compare against.

**Fix:** fetch the branch explicitly and read the real remote head from FETCH_HEAD, then pass an EXPLICIT lease value:
```
git fetch origin <branch>
REMOTE_SHA=$(git rev-parse FETCH_HEAD)
git push --force-with-lease=<branch>:$REMOTE_SHA origin <branch>
```
This keeps the safety (only overwrites if the remote is still at the SHA you last saw) while working around the worktree quirk. Prefer this over a blanket `--force`. (Context: amending a pre-PR fix branch to fold in self-review fixes before opening the PR — no reviewer yet, so rewriting history is fine.)

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789460745636-git-force-with-lease-stale-info-inside-a-worktree-.md`_
