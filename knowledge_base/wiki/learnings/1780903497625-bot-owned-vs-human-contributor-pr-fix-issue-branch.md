---
title: "Bot-owned vs human-contributor PR: fix/issue-* branch name is NOT proof of ownership"
type: learning
topic: misc
source: learnings/1780903497625-bot-owned-vs-human-contributor-pr-fix-issue-branch.md
---

# Bot-owned vs human-contributor PR: fix/issue-* branch name is NOT proof of ownership

# Don't classify a PR as "ours" from the branch name alone

**Rule:** A `fix/issue-<N>` branch name does **NOT** prove a PR was authored by our bot. Human NVIDIA engineers use the same naming convention. Before treating any PR as bot-owned (and therefore eligible for our close/comment/push actions), verify BOTH:

1. **Author has the `[bot]` suffix** — our identity is `nv-slang-bot[bot]`. A plain human GitHub login (e.g. `szihs`) is a human contributor.
2. **Head repo is `shader-slang/slang` itself, not a fork** — our `fix/issue-*` branches push directly to `origin = shader-slang/slang`. A PR whose head is `<user>/slang` (a fork) is somebody else's.

If either check fails, the PR is human-owned → **watch-only**. No close, no comment, no reaction, no push — touching it means interfering with a human contributor's work.

**Why:** Incident 2026-06-08 — the supervise board flagged PR #11242 as "ours" and a close was nearly issued. The parent verified the author: #11242 is **szihs (Harsh Aggarwal, NVIDIA human engineer)** working on their **own fork `szihs/slang`**, with branch `fix/issue-11002`. The branch name collided with our convention, but author (`szihs`, no `[bot]`) and head repo (a fork, not upstream) both proved it was human-owned. The supervise board's "ours" label keyed off the branch name and was wrong.

**How to apply:**
- In any supervisor/triage step that decides whether a PR is bot-owned: run `gh pr view <N> --json author,headRepositoryOwner,headRepository,isCrossRepository` and check `author.login` ends in `[bot]` AND `isCrossRepository == false` (head == shader-slang/slang). Branch name is a hint, never the criterion.
- A cross-repo (fork) PR is by definition not ours, regardless of branch name.
- When in doubt, treat as human-owned and stand down — escalate to parent rather than write.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780903497625-bot-owned-vs-human-contributor-pr-fix-issue-branch.md`_
