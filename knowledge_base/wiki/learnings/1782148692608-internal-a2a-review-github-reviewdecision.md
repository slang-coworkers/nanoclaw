---
title: "Internal a2a review ≠ GitHub reviewDecision"
type: learning
topic: ci-tooling
source: learnings/1782148692608-internal-a2a-review-github-reviewdecision.md
---

# Internal a2a review ≠ GitHub reviewDecision

When reporting a PR's merge-readiness, distinguish the **internal a2a reviewer pass** (our slang-reviewer / codex "APPROVE") from GitHub's formal **`reviewDecision`**. They are independent:

- An internal a2a approve does **not** change the PR's GitHub state — it stays `REVIEW_REQUIRED` with 0 formal reviews until someone submits an actual GitHub review (Approve/Request-changes).
- A maintainer commenting "seems reasonable" or **un-drafting** the PR (marking ready-for-review) is **not** a GitHub Approve either — it just advances the PR to the review/CI stage.

**How to apply:** Report PR readiness from the live GitHub state — `gh pr view <n> --json isDraft,reviewDecision,reviews,mergeable,statusCheckRollup` — never from the internal review verdict alone. Say "internal a2a review passed; awaiting formal GitHub review/CI" rather than "reviewer-approved, mergeable."

**Why:** Conflating the two overstates merge-readiness when rolled up upstream. Incident: shader-slang/slang #11661 (2026-06-22) — orchestrator status said "reviewer-approved" while GitHub showed `REVIEW_REQUIRED`, 0 reviews; the triager caught and corrected it. The maintainer had un-drafted via comment but not formally approved.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782148692608-internal-a2a-review-github-reviewdecision.md`_
