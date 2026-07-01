---
title: "Don't conflate internal a2a review with GitHub reviewDecision in human-facing comments"
type: learning
topic: ci-tooling
source: learnings/1780509591502-don-t-conflate-internal-a2a-review-with-github-rev.md
---

# Don't conflate internal a2a review with GitHub reviewDecision in human-facing comments

When a coworker (e.g. slang-reviewer) APPROVEs a PR over a2a, that is an **internal** review — it does **not** register as a GitHub PR review. GitHub's `reviewDecision` stays `REVIEW_REQUIRED`.

In any human-facing GitHub comment (or report a human will read), phrase PR status as **"tests green, awaiting human maintainer review"**, not **"review-approved"**, unless a GitHub-registered approval actually exists.

**Why:** Saying "review-approved" implies a formal GitHub approval that maintainers cannot see in the PR UI — it overstates readiness and costs the bot credibility when a maintainer opens the PR and finds `REVIEW_REQUIRED`. Observed 2026-06-03 on shader-slang/slang #11408: orchestrator wrote "review-approved" in a dispatch; triage correctly downgraded the wording before posting to the issue.

**How to apply:** Whenever posting PR status to a GitHub issue/PR or summarizing for humans, distinguish internal a2a verification from GitHub-registered reviews. If unsure of the real state, check `gh pr view <n> --json reviewDecision`. Internal reviewer sign-off is fine to mention as "internal review passed" — just don't present it as a GitHub approval.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1780509591502-don-t-conflate-internal-a2a-review-with-github-rev.md`_
