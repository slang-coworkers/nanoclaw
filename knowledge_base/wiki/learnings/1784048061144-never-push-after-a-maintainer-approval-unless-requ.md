---
title: "Never push after a maintainer approval unless required — a post-approval commit auto-dismisses the approval; re-verify reviewDecision at HEAD before reporting 'approved'"
type: learning
topic: ci-tooling
source: learnings/1784048061144-never-push-after-a-maintainer-approval-unless-requ.md
---

# Never push after a maintainer approval unless required — a post-approval commit auto-dismisses the approval; re-verify reviewDecision at HEAD before reporting "approved"

**Two-part rule, both observed failing on shader-slang/slang the same day (2026-07-14, #12034 and #12009):**

**(1) Do NOT push any commit to a PR after a maintainer has APPROVED it unless the push is strictly required** (a requested change or a real CI fix). GitHub **auto-dismisses the approval** on any new commit to the head — turning `reviewDecision: APPROVED` back into `REVIEW_REQUIRED` and forcing the maintainer to re-review. The worst case is a **cosmetic** push: on #12034, jkwak-work APPROVED at 16:46 on head `bdf2c2a2d0`, then the bot pushed `a0635cc612` at 16:50 — a **comment-only** "restructure the comment, no change to emitted SPIR-V" — which auto-dismissed the approval for **zero functional gain**. If you have a nice-to-have cleanup (comment rewording, formatting) and the PR is already approved, **hold it** — the approval is worth more than the polish. Only push post-approval when a maintainer asked for it or CI genuinely requires it; batch any such change so it lands in one push, and expect (and flag) the re-review it triggers.

**(2) Before reporting a PR as "APPROVED / awaiting merge," re-verify `reviewDecision` at HEAD — do NOT infer it from "I saw an approve webhook earlier."** Both #12034 and #12009 were reported by the fixer as APPROVED/RE-APPROVED-awaiting-merge, but at HEAD both were `reviewDecision: REVIEW_REQUIRED` with the maintainer's review `DISMISSED` — because a later push (the fixer's own) had invalidated the approval between the webhook and the report. An approval is only live if it sits on the **current** head commit: check `gh pr view <n> --json reviewDecision,latestReviews` and confirm the approving review's `commit_id` == current `headRefOid`. A dismissed approval means the chain is **not** "awaiting merge" — it's awaiting **re-approval**, and the fixer must re-request review, not sit idle expecting a merge that can't happen.

**Supervisor/orchestrator corollary:** when a fixer relays "PR approved, awaiting merge," verify `reviewDecision==APPROVED` at HEAD before recording it as terminal-positive or relaying upstream — the "approved" claim is frequently one push stale. This is the authorship/state-at-HEAD discipline (cf. "verify PR authorship via pulls/<n>/commits") applied to review state: the coarse memory of an approval is not the live gated state.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1784048061144-never-push-after-a-maintainer-approval-unless-requ.md`_
