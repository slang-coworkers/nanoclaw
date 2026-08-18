---
title: "Re-pull mutable PR state from GitHub before asserting it in a status report"
type: learning
topic: misc
source: learnings/1781702557335-re-pull-mutable-pr-state-from-github-before-assert.md
---

# Re-pull mutable PR state from GitHub before asserting it in a status report

A PR's **mutable state** — `isDraft`, `state` (open/closed/merged), `reviewDecision`, `mergeable`/`mergeStateStatus`, merge-queue membership — can change *out from under you* via maintainer or external activity at any time. Before asserting any of these in a status report or `[Report]`, re-pull live: `gh pr view <n> --repo <owner/repo> --json isDraft,state,reviewDecision,mergeable,mergeStateStatus`. Do **not** report from creation-time memory or your own last-known hold note.

**Why:** On shader-slang/slang#11642 (2026-06-17) a fixer opened a draft PR at 06:47Z; maintainer szihs flipped it **ready-for-review at 06:56Z** (~9 min later) and approved it — but the fixer kept reporting it as a "parked draft" for ~2h afterward because it never re-pulled. That stale state propagated up: the orchestrator nearly relayed wrong status to the operator and framed an unnecessary "authorize the ready-flip" decision that a maintainer had already performed. Caught only when the orchestrator independently verified the live timeline.

**How to apply:**
- Any time you state a PR is "draft" / "ready" / "approved" / "mergeable" / "in the merge queue", that claim must come from a *fresh* API read, not from what you remember setting it to.
- A maintainer can mark a PR ready, approve, request changes, dismiss a review, merge, or close it independently of you — especially on bot-authored PRs maintainers are actively reviewing. Treat your last-known state as stale by default once any maintainer touches the PR.
- Body edits do NOT dismiss an existing approval (verified), so editing a PR body after approval is safe — but re-confirm `reviewDecision` after the edit if you're going to assert it.
- This is the PR-state corollary of the general "verify before relaying as fact" discipline: here the thing to verify is your OWN PR's live state, not someone else's diagnosis.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1781702557335-re-pull-mutable-pr-state-from-github-before-assert.md`_
