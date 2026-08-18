---
title: "[approver/infra-abstain] harvest exit 20 on a fresh external-fork PR is a TIMING race with the Claude PR Review check, not a production-skip — wait, don't fall to Devin-only"
type: learning
topic: review-approval
source: learnings/1783767626000-approver-infra-abstain-harvest-exit-20-on-a-fresh-.md
---

# [approver/infra-abstain] harvest exit 20 on a fresh external-fork PR is a TIMING race with the Claude PR Review check, not a production-skip — wait, don't fall to Devin-only

**Symptom:** On slang#12064, `harvest-reviews.py` returned exit 20 ("no harvestable bot review -> Devin-only") ~2 min after the PR opened. The workflow's exit-20 branch says "fall to Devin-only" (production skips fixer/bot/Claude branches). But this was an EXTERNAL-FORK human PR (LDeakin) — production does NOT skip those. The `Claude PR Review` CI check was still IN_PROGRESS; the `github-actions[bot]` review simply hadn't posted yet.

**Root cause:** harvest exit 20 = "no bot review present RIGHT NOW", which conflates two very different cases: (a) production genuinely skips this PR class (fix/issue-N, bot-authored, Claude branches) → Devin-only is correct; (b) production WILL review but the check hasn't finished → falling to Devin-only prematurely discards the authoritative primary review and, if Devin also fails, needlessly risks NO_REVIEW_SIGNAL / a weaker fallback verdict.

**How to catch it:** before treating exit 20 as a production-skip, check `gh pr view <pr> --json statusCheckRollup` for a check named `review` (workflow "Claude PR Review"). If it's QUEUED/IN_PROGRESS, exit 20 is a timing race — the PR is not in a skipped class. Cross-check the author: external-fork / first-time-contributor / member human PRs are reviewed; only `fix/issue-N` fixer branches, bot authors, and Claude's own branches are skipped.

**Fix:** when the review check is still running on a non-skipped PR, arm a Monitor on the check reaching COMPLETED, then RE-HARVEST (it flips to exit 0). Run Devin head-current in parallel meanwhile (it's the approver's own signal), but don't let a premature exit-20 fall-through throw away the primary review production is about to post. Reuse-don't-re-derive means waiting for the primary review when it's genuinely coming. (On #12064 the re-harvest after the check completed returned exit 0, github-actions[bot] @ pinned head, and drove the decision.)

**Also:** devin-fetch.sh in the skill dir is not +x — invoke via `bash <path>`, not directly (Permission denied otherwise). And killing the devin-fetch wrapper orphans its chromium children; clean them up by matching `user-data-dir=/tmp/agent-browser-chrome`.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783767626000-approver-infra-abstain-harvest-exit-20-on-a-fresh-.md`_
