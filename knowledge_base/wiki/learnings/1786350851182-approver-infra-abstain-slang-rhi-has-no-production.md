---
title: "[approver/infra-abstain] slang-rhi has NO production review bot — it is permanently fallback-tier, and Devin timing out is the norm not the exception"
type: learning
topic: review-process
source: learnings/1786350851182-approver-infra-abstain-slang-rhi-has-no-production.md
---

# [approver/infra-abstain] slang-rhi has NO production review bot — it is permanently fallback-tier, and Devin timing out is the norm not the exception

## Symptom

Two `/slang-pr-approve` runs on shader-slang/slang-rhi#820 (two heads) both found
**no** `github-actions[bot]` claude-code-action review to harvest, and Devin
timed out on both (`devin-fetch.sh` exit 3 — no stable done state within 20m, no
`devin-flags.md` produced). Taken naively that combination is
`ABSTAIN_INFRA:NO_REVIEW_SIGNAL` on every single slang-rhi PR.

## Root cause

Two separate facts, easy to conflate:

1. **slang-rhi's `Claude Code Assistant` check-run reports
   `completed/skipped`** — not `pending`, not `failure`. That is a *genuine
   skip*: this repo does not run the production claude-code-action review
   pipeline that shader-slang/slang runs. There is no primary review to wait for
   at any head, ever. So slang-rhi decisions are **permanently fallback-tier**
   (CodeRabbit primary + Devin), and the absence of a production review is NOT
   an infra defect to burn down.
2. **`coderabbitai[bot]` IS reliable here** — but it re-reviews on every push,
   which means right after a `synchronize` the harvest legitimately returns exit
   10 (stale: `commit_id` = previous head, `inline_comment_count_at_pinned=0`)
   with the commit status flipping back to `pending`. That is a timing race on a
   fresh head, not a skip.

Distinguishing `completed/skipped` (never coming) from `pending` (imminent) is
the whole game. Reading both as "no signal" manufactures a false
`ABSTAIN_INFRA`; reading both as "wait" hangs forever.

## How to catch it

- `gh api repos/<r>/commits/<sha>/check-runs` → a review bot at
  `completed/skipped` means **stop waiting, fall to the next tier, and do not
  record an infra abstain for its absence**.
- CodeRabbit's signal lives in the **combined commit status**
  (`/commits/<sha>/status` → `context: "CodeRabbit"`), not in check-runs. `pending`
  there = re-review in flight ⇒ wait, then re-harvest.
- Never fold that combined `/status` into a CI-green claim: on this PR it read
  `pending` purely because CodeRabbit hadn't reported, while the actual `ci` run
  was `completed/success` with 18/18 build legs green. `state` folds over
  whatever statuses happen to exist and knows nothing about builds.
- **Devin timing out is the common case for slang-rhi PRs (2/2 here, plus prior
  rows on #797 and #770).** Treat it as best-effort-absent and say so; do not let
  it alone drive `NO_REVIEW_SIGNAL` when a bot review was harvested.

## Fix

Recorded `ABSTAIN_POLICY:OPEN_GAP` on real code findings rather than
`ABSTAIN_INFRA:NO_REVIEW_SIGNAL`, with `reviewers_complete:true` justified by the
head-current CodeRabbit review. Noted in the row that the missing production
review is a repo property, not a pipeline failure — so it never counts against
the infra-abstain gate. Prior related row: #598, where I over-claimed
`NO_REVIEW_SIGNAL` in a comparable situation.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786350851182-approver-infra-abstain-slang-rhi-has-no-production.md`_
