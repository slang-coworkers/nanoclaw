---
title: "Verify a PR's live state before rolling a fixer's PR-state claim upstream — maintainer-side actions go stale fast"
type: learning
topic: verification
source: learnings/1782954654263-verify-a-pr-s-live-state-before-rolling-a-fixer-s-.md
---

# Verify a PR's live state before rolling a fixer's PR-state claim upstream — maintainer-side actions go stale fast

**Rule:** When a fixer/child reports a PR's state (draft/ready, head SHA, review verdict, "held pending X"), verify it directly with `gh pr view <N> --json isDraft,headRefOid,reviewDecision,state,mergeable` + the issue/PR timeline **before** you surface a state-dependent decision to the operator/parent.

**Why:** On shader-slang/slang#11881 / PR #11883, the fixer reported (accurately about its *own* actions) "did NOT flip ready" and teed up an **operator ready-flip decision** for me to surface upstream. But the maintainer (jkwak-work) had already, ~2 min earlier, driven the PR himself: GitHub "Update branch" (head moved from the fixer's `b5f4e43112` to a maintainer merge commit `a538af6146`), `ready_for_review`, then APPROVE — and minutes later, MERGE. Had I relayed the fixer's framing verbatim, I'd have asked the operator to authorize a ready-flip that was already done, and mis-stated the head SHA and gate. A child's report is a snapshot of *its* actions; it can be blind to maintainer-side moves (update-branch, ready-flip, approve, merge) that happen out-of-band.

**How to apply:**
- Before any upstream rollup that carries a decision or a state claim, run `gh pr view --json isDraft,headRefOid,reviewDecision,state,mergeable` and, if attributing an action, `gh api repos/<o>/<r>/issues/<N>/timeline` (filter `ready_for_review`/`convert_to_draft`/`merged`) + `gh api .../commits/<sha>` to see who did what.
- GitHub's "Update branch" merge does **not** dismiss an existing approval (reviewDecision stays APPROVED on the new merge-commit head) — so an approval landing *after* an update-branch is still valid; don't assume a moved head means a dismissed review.
- A maintainer flipping ready / merging their **own assigned** PR is legitimate and does NOT violate a bot "don't-flip-ready/don't-merge" guardrail — the guardrail constrains the bot, not the human. Distinguish "who acted" before flagging a violation.
- Corollary: once a maintainer merges an APPROVED+MERGEABLE bot PR, a "wait for the real (priority-yielded) CI" hold becomes **moot** — stop holding; the merge is the terminal signal.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782954654263-verify-a-pr-s-live-state-before-rolling-a-fixer-s-.md`_
