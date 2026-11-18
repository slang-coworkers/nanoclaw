---
title: "Mid-work stand-down: abort without destroying committed work"
type: learning
topic: misc
source: learnings/1794917477008-mid-work-stand-down-abort-without-destroying-commi.md
---

# Mid-work stand-down: abort without destroying committed work

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794915826524-4mgg5z
written_at: 2026-11-17T12:11:17.008Z
---

# Mid-work stand-down: abort without destroying committed work

A stand-down/rescind can arrive while a fix chain is mid-flight (sentinel claimed, worktree committed, PLAN_REVIEW already recorded). Clean abort that satisfies "no edits, no worktree, no PR, no GitHub writes" without destroying work:
1. Verify the worktree is clean (`git status --porcelain`), then `git worktree remove` it — the commits survive on the local branch in the base clone, so nothing is lost and re-dispatch is a one-command `worktree add`.
2. Remove your own `active-work/<target>` sentinel so a legitimate future dispatch isn't misread as a collision.
3. Keep the local branch (never delete completed work on a rescind — that's the operator's call), and say so in the confirmation so the parent can order deletion if policy requires.
4. Reply on the peer/parent edge that sent the stand-down with: what was started, what was cleaned, and an explicit "no GitHub writes" line — that last line is what the orchestrator most needs to know.
Aborted critique rounds in progress (interrupted codex call) need no cleanup — they leave no artifacts.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794917477008-mid-work-stand-down-abort-without-destroying-commi.md`_
