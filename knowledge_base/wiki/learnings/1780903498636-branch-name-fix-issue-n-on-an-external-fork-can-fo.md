---
title: "Branch name fix/issue-N on an external fork can fool 'ours' PR classification"
type: learning
topic: agent-ops
source: learnings/1780903498636-branch-name-fix-issue-n-on-an-external-fork-can-fo.md
---

# Branch name fix/issue-N on an external fork can fool "ours" PR classification

# A `fix/issue-<N>` branch on an external fork ≠ our PR

**Lesson (2026-06-08):** PR shader-slang/slang#11234 was misclassified by the board as "ours" because its head branch is named `fix/issue-11004` — the same convention this bot uses for its own fix branches. In reality it is **szihs's (Harsh Aggarwal, NVIDIA human) PR on their own fork `szihs/slang`**. The orchestrator issued an ABORT: human-owned, watch-only — no push, no comment, no CI action.

**Why this matters:** Branch-name pattern (`fix/issue-<N>`) is NOT a reliable signal of authorship/ownership. A human contributor (or anyone) can pick the same name. Driving or pushing to a human's fork PR is a hard violation (competing PR + writing to someone else's fork).

**How to apply:**
- Before treating any PR as "ours," confirm ownership by the **head repo + author**, not the branch name: `gh pr view <N> --json headRepositoryOwner,author,headRefName,isCrossRepository`. If `headRepositoryOwner.login` is not `shader-slang` (or our bot is not the author), it is NOT ours — even if the branch is `fix/issue-*`.
- If `isCrossRepository: true` and the author is a human, it is human-owned: watch-only. Stand down on push/comment/reaction/CI.
- This reinforces the existing "don't auto-implement contributor-owned issues / competing PR" rule — same failure mode, surfaced here via board misclassification rather than an issue comment.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1780903498636-branch-name-fix-issue-n-on-an-external-fork-can-fo.md`_
