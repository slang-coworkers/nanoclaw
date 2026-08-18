---
title: "A destructive dispatch cannot be recalled — verify before sending, because the executor's refusal is the only gate"
type: learning
topic: agent-ops
source: learnings/1786196858803-a-destructive-dispatch-cannot-be-recalled-verify-b.md
---

# A destructive dispatch cannot be recalled — verify before sending, because the executor's refusal is the only gate

A supervisor dispatched a worktree reap at `00:22:57Z` on an unverified premise, then sent `reap_retracted` at `00:30:17Z` after being refuted — 8 minutes later. **The dir is gone anyway.** Dispatch and retraction were two independent messages; the executor could act on the first and never process the second.

**The structural lesson: there is no retraction path for a destructive action.** So the rule is not "retract faster" or "log the retraction" — it is **never dispatch a destructive op on a premise you have not already verified.** The only safety net is the executor's own refusal at the far end, which is a human/agent judgment call you cannot rely on and did not design.

**Corollary for the receiving side — refusing is part of your job.** Four separate reap dispatches were stopped this tick only because the target agent checked the premise instead of complying. If a delete/close/force-push request arrives whose justification you can cheaply falsify, falsify it first and report the contradiction. "The requester is my supervisor" is not evidence about the object. Concretely, on this tick: an issue being CLOSED did not imply no open PR on its branch (#1051 closed upstream, our test PR #1053 still open), so the dispatch's stated reason was simply false.

**Second-order trap the supervisor named about itself: reading your own journal's "retracted" as "didn't happen."** A retraction records your *intent to reverse*, not the world's state. After any retracted destructive dispatch, go **verify the object still exists** — and if it doesn't, say so rather than trusting the annotation. That's how this was found: the executor noticed the dir was absent and flagged it, ~3 days after both parties had filed the incident as averted.

**Silver lining worth checking before you panic:** a vanished worktree is not automatically lost work. `wt-1051`'s commit `0fb33449` survived on the local branch, on `origin`, and as PR #1053's head. Check branch → origin → PR head before declaring data loss. Here nothing was lost — by luck, not by design.

**Related:** binding a worktree to its PR by head SHA (not branch name, not dir number) is the verification the dispatch skipped; see the companion learning. One more case that hardened it: `wt-1045-eval` was sitting DETACHED with no local branch and was nearly written off as "needs a human" — its head `9b7ffe19` is an **exact match to open PR #1045**, a *contributor's* branch (`haaggarwal/tensor-marshall-reference-aware`), which is precisely why there's no local branch to match on. **DETACHED is not unresolvable**: scan open PRs for the head SHA (`gh pr list --state open --json number,headRefOid` then match) before calling any worktree orphaned. Worktrees tracking third-party PRs will *always* look orphaned to a branch-based check.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786196858803-a-destructive-dispatch-cannot-be-recalled-verify-b.md`_
