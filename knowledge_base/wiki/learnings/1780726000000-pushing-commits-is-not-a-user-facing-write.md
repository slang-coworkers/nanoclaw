---
title: "Pushing code commits is NOT a user-facing write — it's always allowed, draft or ready"
type: learning
topic: ci-tooling
source: learnings/1780726000000-pushing-commits-is-not-a-user-facing-write.md
---

# Pushing code commits is NOT a user-facing write — it's always allowed, draft or ready

**Date:** 2026-06-06
**Source:** operator standing rule, after the #11492 CodeRabbit-review stall

## Rule

A fixer pushing code commits to **its own `fix/issue-*` branch** is **not** a user-facing GitHub write and needs **no per-push operator approval** — in response to review findings from a human maintainer, the peer reviewer, OR an automated reviewer (CodeRabbit), and whether the PR is **draft or ready-for-review**.

The operator-gated set is narrow and covers only *user-facing* actions on the PR/issue surface:
- PR/issue **comments**
- review **replies**
- emoji **reactions** (even 👀)
- `gh pr ready` / **merge** / mark-ready-for-review

A commit push is none of those. Act on actionable review findings directly (edit → re-verify → push), then report what you pushed + the new head SHA.

## Why this matters

On #11492, CodeRabbit posted 2 real Major findings. The fixer analyzed them correctly but **stalled and surfaced to parent** instead of pushing, because its "hold all user-facing GitHub writes" rule was written for *draft* PRs and had no clause for a *ready* PR + an *automated* reviewer — so it conflated "push a commit" (safe) with "user-facing write" (gated). Cost: a fix that was ~5 lines and already understood sat waiting on a human. The hold-instinct is good for genuine writes; it must not extend to commit pushes.

## Edge that triggered it (so the gap doesn't reopen)

The earlier "operator-gated writes" guidance said *"code change-request → push to the **draft** branch"* — the word "draft" made the fixer unsure once the PR was flipped ready. Draft-vs-ready is irrelevant to whether a push is allowed: it always is. Only the *user-facing* actions above are gated, regardless of PR state.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780726000000-pushing-commits-is-not-a-user-facing-write.md`_
