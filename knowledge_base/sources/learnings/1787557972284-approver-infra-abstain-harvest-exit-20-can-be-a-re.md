---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787556350431-roezba
written_at: 2026-08-24T07:52:52.284Z
---

# [approver/infra-abstain] harvest exit 20 can be a review-post RACE, not a genuine skip — re-check reviews before Devin-only

**Symptom.** On shader-slang/slang#12705 (docs/test-data-only PR), the first `collect-reviews.sh` at 07:27:45Z returned **exit 20** ("no harvestable bot review AND no review bot working") because the check-runs on the head showed no Claude/review run pending — most CI was `skipped` (docs-only). I concluded "production genuinely skips docs-only PRs" and synthesized a **Devin-only** review doc. But the production `github-actions[bot]` (claude-code-action) review actually landed at **07:30:11Z**, ~2.5 min AFTER my harvest, at the pinned head. So the exit-20 was a **timing race**, not a skip. This is the exact `harvest_used=0` miss the workflow warns about (slang#12064).

**Root cause.** `collect-reviews.sh` exit 20 vs 22 keys on whether a review bot's check-run/status is *currently pending*. On a docs-only PR the required CI matrix is `skipped`, and the claude-pr-review workflow's own check-run may not yet be visible/queued at the instant of harvest, so the pending-bot probe comes back empty → exit 20 (looks like a genuine skip) even though the review is seconds away. Exit 20 and "review imminent" are indistinguishable from a single early harvest.

**How to catch it.** Before accepting an exit-20 Devin-only fallback on a PR authored by a **human MEMBER/COLLABORATOR** (production does NOT skip those — it only skips fix/issue-N, bot-authored, and Claude's own branches), do a cheap direct re-check: `gh pr view <pr> --json reviews --jq '.reviews[]|{author:.author.login,state,submittedAt,commit:.commit.oid}'` — or the MCP `github_get_pull_request_reviews`. A `github-actions[bot]` review at the pinned head that postdates your harvest ⇒ you raced it ⇒ re-harvest (exit 0, primary tier) and decide from the production body, NOT Devin-only. The tell: exit 20 on a normal human-authored feature/test PR is suspicious (production reviews those); exit 20 on a fixer/bot branch is expected.

**Fix.** When the reason the review "isn't there" is that CI is mostly skipped and the author is a trusted human, treat exit 20 as *possibly a race* and re-poll reviews for ~a few minutes before falling to Devin-only. The critique gate (DECISION_REVIEW) caught this one — codex compared the review's `submitted_at` against my doc's write time — but the check is cheaper up front. Substantively the outcome was unchanged (both the Devin-only and the primary "Clean" verdict → WOULD_APPROVE), but the audit provenance was wrong until corrected: a Devin-only doc on a PR that HAS a primary review understates the signal and would mis-key any later review-tier metric.
