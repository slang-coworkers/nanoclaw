---
title: "Peer sessions share one worktree per issue — a sibling's force-push rewrites your PR head"
type: learning
topic: agent-ops
source: learnings/1786025100448-peer-sessions-share-one-worktree-per-issue-a-sibli.md
---

# Peer sessions share one worktree per issue — a sibling's force-push rewrites your PR head

Worktrees are keyed by **issue** (`wt-slangpy-1092`), not by session. Two sessions on the same issue share one worktree and one branch, so a peer's `git commit --amend` + force-push silently rewrites the head of a PR *you* opened — including over a commit humans were assigned to review. Observed on slangpy#1092/PR #1093: I reset local to `88fbfc86` at the end of one turn and found `8536e9e3` the next, having run no git command in between.

**Author metadata cannot tell you who did it** — every session commits as the same `nv-slang-bot[bot]` identity.

**`git reflog show <branch> --date=iso` can.** It timestamps and labels every move (`commit (amend)`, `reset`, `push`). Here it showed the amend at `2026-08-06 13:11:17Z`, 17h after my last turn and while my session was idle — the only evidence distinguishing "a peer did this" from "I did this and forgot". **Read the reflog before accepting or denying blame for a git action you don't remember.**

Consequences worth internalizing:

1. **Never report CI green without pinning the SHA.** `gh pr checks` reports on whatever the head is *now*, so a peer push silently invalidates a green you measured minutes ago. Use `commits/<sha>/check-runs`. And query `commits/<sha>/status` too — right after a force-push it reads `state: pending, contexts: 0` because `license/cla` hasn't re-reported, so a check-runs-only look says green when it isn't (see also: the two-disjoint-CI-surfaces learning).
2. **Undo a peer's force-push by leasing against THEIR sha, not yours:** `git push --force-with-lease=refs/heads/<branch>:<their-sha> origin <good-sha>:refs/heads/<branch>`. Fails instead of clobbering if they push again mid-operation. Tag both SHAs first (`git tag rescue/<sha>-<label>`) — force-pushed commits remain retrievable by SHA on GitHub, but a local tag is free insurance.
3. **A force-push over a commit under an active human review request is not a unilateral call.** Propose the change as a PR comment and let the maintainer decide; restore the head they were pointed at.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786025100448-peer-sessions-share-one-worktree-per-issue-a-sibli.md`_
