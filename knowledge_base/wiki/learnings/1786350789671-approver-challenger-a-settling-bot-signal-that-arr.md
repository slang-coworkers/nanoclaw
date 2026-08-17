---
title: "[approver/challenger] A settling bot signal that arrives after your timeout but before you RECORD supersedes the timeout"
type: learning
topic: review-approval
source: learnings/1786350789671-approver-challenger-a-settling-bot-signal-that-arr.md
---

# [approver/challenger] A settling bot signal that arrives after your timeout but before you RECORD supersedes the timeout

## Symptom

On slang-rhi#820 R2 the review bot (CodeRabbit) was still `pending` through the
`/slang-pr-approve` `pending_bot` window (12 polls @30s ≈ 6 min, commit-status
`updated_at` frozen the whole time). By the letter of the workflow that permits
falling to the Devin tier — and Devin had also timed out (exit 3) — so the
synthesized doc got `reviewers_complete:false`, which maps to
`ABSTAIN_INFRA:NO_REVIEW_SIGNAL`.

Then, ~7 minutes after the window closed and while I was still assembling the
decision, the bot settled to `success` and posted a **head-current** review with
3 inline comments — including two 🟠 Majors I had not found.

## Root cause

The `pending_bot` window is a bound on *how long to block*, not a declaration
that the signal no longer exists. The artifact that matters is what is
observable **at the moment you write the ledger row**, because the row is the
claim. Treating "my poll loop expired" as "no review exists" converts a
scheduling decision into a false factual claim about the PR.

An `ABSTAIN_INFRA` here would also have been actively misleading: it names a
pipeline defect ("no review signal") that had ceased to be true, burning down
the wrong quality gate and hiding two real code findings behind an infra excuse.

## How to catch it

**Re-harvest immediately before `record_decision` whenever the prior harvest was
non-zero (stale/pending/timed-out).** It is one cheap read-only call. The
decision is keyed on `(repo, pr, commit_sha)`, not on when you started, so a
fresher signal for the SAME commit is strictly better input — no
revision-independence rule is violated.

Generalization: **a timeout is evidence about my patience, never about the
world.** Any "X did not happen" conclusion derived from a poll loop expiring
must be re-checked at the moment of commitment. Same shape as the
absence-claim-decays rule, but the trigger is specifically *my own* bounded wait.

## Fix

Re-ran `collect-reviews.sh` on the settled status: exit went 10 (stale) → **0**
(head-current, `stale=false`, `inline_comment_count_at_pinned=3`). Verified both
🟠 findings in source, and the decision moved from
`ABSTAIN_INFRA:NO_REVIEW_SIGNAL` (a false pipeline defect) to
`ABSTAIN_POLICY:OPEN_GAP` (the true state: a human must look at two confirmed
Vulkan guard gaps). Recorded the sequencing explicitly in the decision row's
`challenger.sequencing_disclosure` so the audit trail shows why the doc changed.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786350789671-approver-challenger-a-settling-bot-signal-that-arr.md`_
