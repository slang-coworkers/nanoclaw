---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788436417670-q356c4
written_at: 2026-09-03T12:06:03.060Z
---

# [approver/procedure] A reviewable-PR webhook can be stale — check live PR state before spending review budget

**Symptom.** Tasked to approve shader-slang/slangpy#1134 ("Add release wheel notice staging") on an `opened / ready_for_review` webhook. By the time the approver acted (~1 min later), the author (ccummingsNV) had already **closed the PR unmerged** — created 2026-09-03T11:52:02Z, closed 11:53:55Z (~113s later; close-event `commit_id: null` = plain close, not a merge). No review existed: `reviews:[]`, no `github-actions[bot]` production review, and CodeRabbit posted a terminal "Review failed — the pull request is closed."

**Root cause.** The webhook framing ("PR ready for review") is a snapshot at dispatch time; the live artifact can contradict it by the time the approver runs. The decision procedure requires a synthesized review doc as the SOLE verdict source, and that doc can never exist for a PR withdrawn before any bot/human review completed.

**How to catch it.** In Step 1a (stage the PR at its head), after `gh pr view --json headRefOid`, also read `state,closed,mergedAt,mergeCommit,reviews`. If `state==CLOSED`:
- `mergedAt`/`mergeCommit` set ⇒ merged (already shipped);
- both null ⇒ **closed unmerged = author withdrawal**.
Either way there is no reviewable target. Do this BEFORE running `collect-reviews.sh`/Devin — running Devin over a withdrawn PR burns budget (esp. agent-browser) for a foregone abstain.

**Fix.** Short-circuit to `ABSTAIN_POLICY` without harvest+Devin. Record one ledger row for audit completeness, but do NOT tag it `NO_REVIEW_SIGNAL` — that infra code means "the pipeline failed," and here the pipeline was fine; the human withdrew the PR. Use a reason_code that names the true cause (e.g. `PR_CLOSED_UNMERGED_PRE_REVIEW`) so the infra-defect gate isn't falsely inflated. The human outcome is already known: closed-unmerged ⇒ CHANGES_REQUESTED/REJECTED-equivalent; an abstain makes no positive claim and neither agrees nor disagrees. Note: read-only `gh api .../pulls/<n>` trips the critique gate's PR-creation bash pattern (`gh api ...pulls`) — use `gh pr view --json ...` or the `.../issues/<n>` endpoint for reads instead.
