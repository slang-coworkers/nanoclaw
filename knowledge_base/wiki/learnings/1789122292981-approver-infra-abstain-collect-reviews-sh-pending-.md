---
title: "[approver/infra-abstain] collect-reviews.sh pending_bot misses a check-run literally named 'review' (near-miss Devin-only fallback)"
type: learning
topic: review-process
source: learnings/1789122292981-approver-infra-abstain-collect-reviews-sh-pending-.md
---

# [approver/infra-abstain] collect-reviews.sh pending_bot misses a check-run literally named "review" (near-miss Devin-only fallback)

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789120897809-11sgm6
written_at: 2026-09-11T10:24:52.981Z
---

# [approver/infra-abstain] collect-reviews.sh pending_bot misses a check-run literally named "review" (near-miss Devin-only fallback)

**Symptom.** On shader-slang/slang#13004 (a fresh `ready_for_review`/`opened` PR), `collect-reviews.sh` returned **exit 20** ("no harvestable bot review AND no review bot still working") even though the production **"Claude PR Review"** workflow (`.github/workflows/claude-pr-review.yml`) was actively running on the head. Exit 20 tells the workflow to fall to **Devin-only** — which discards the primary `github-actions[bot]` review signal (exactly the slang#12064 `harvest_used=0` miss).

**Root cause.** The production PR-review job surfaces on the commit as a check-run whose **name is literally `review`** (app=`github-actions`, status=`in_progress`). `collect-reviews.sh`/`harvest-reviews.py` `pending_bot` detection did not match that name, so it classified "no bot working" (exit 20) instead of "bot still running" (exit 22). Two other signals were red herrings that made exit 20 look plausible: CodeRabbit had already posted a terminal **"Review skipped — path filter `!**/generated/**`"** status=success (so no CodeRabbit review either), and the heavy test matrix was **path-skipped** (only `check-ci`/`board-sync` ran).

**How to catch it.** After a harvest exit of 20 on a **human-authored, non-fixer** PR, do NOT trust it blindly — cross-check live state before falling to Devin-only:
`gh api repos/<repo>/commits/<sha>/check-runs --jq '.check_runs[] | select(.status=="in_progress") | .name'` and look for an in-progress `review` check-run (confirm via `gh api .../actions/runs/<id> --jq .name` == "Claude PR Review"). If present, treat as **exit 22**: poll the check-run to `completed` (~30s intervals, ~6 min cap), then **re-run the harvest** — it returns exit 0 once `github-actions[bot]` posts. On #13004 this recovered the primary review (verdict 🟡 APPROVE_WITH_NITS) instead of a Devin-only decision.

**Fix (tooling).** `collect-reviews.sh`/`harvest-reviews.py` `pending_bot` detection should treat an in-progress `github-actions`-app check-run named `review` (the slang claude-pr-review job) as a pending primary bot → exit 22, not exit 20. Exit 20 should be reserved for PRs the production review genuinely skips (fixer `fix/issue-N`, bot-authored, Claude's own branches).

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789122292981-approver-infra-abstain-collect-reviews-sh-pending-.md`_
