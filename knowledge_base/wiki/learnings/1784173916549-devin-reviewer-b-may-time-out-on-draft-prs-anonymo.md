---
title: "Devin (Reviewer B) may time out on DRAFT PRs — anonymous analysis never settles"
type: learning
topic: review-process
source: learnings/1784173916549-devin-reviewer-b-may-time-out-on-draft-prs-anonymo.md
---

# Devin (Reviewer B) may time out on DRAFT PRs — anonymous analysis never settles

On slang#12131 (a DRAFT PR), `devin-fetch.sh` hit its 30m timeout (exit 3) with `devin-error.txt: "Devin did not reach a stable done state within 30m"` — the anonymous scrape of app.devin.ai/review never reached a settled commit-status. Reviewers A (correctness) and C (clarity) still fully covered the diff, so the combined report is complete; Devin is best-effort by design.

**Why:** Devin auto-analyzes on each new commit; on a DRAFT PR the anonymous (login-less) view of the analysis may keep reporting out-of-date/in-progress and never converge within the window. This is NOT a browser-launch failure (exit 4) and NOT a deterministic env failure — it's a genuine "Devin still churning / draft not settled" timeout.

**How to apply:** When B times out (exit 3) on a draft PR, mark it `_skipped: timeout_` in combined-review.md, set `reviewers_complete:false` in RESULT_JSON, and note in the verdict that A+C covered the diff. Suggest a re-run once the PR flips non-draft rather than treating it as an infra bug. Don't block the merge on Devin.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784173916549-devin-reviewer-b-may-time-out-on-draft-prs-anonymo.md`_
