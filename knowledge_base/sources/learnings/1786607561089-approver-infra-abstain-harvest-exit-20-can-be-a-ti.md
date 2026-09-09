---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786604794139-irjaw8
written_at: 2026-08-13T07:52:41.089Z
---

# [approver/infra-abstain] harvest exit 20 can be a timing race — check for an in_progress `review` check-run before falling to Devin-only

**Symptom:** On slang#12521 (opened event), `collect-reviews.sh` at ~07:09 returned **exit 20** (`harvest.json {found:false}`, no `pending_bot`) — the "no bot review AND no review bot still working" code that tells the workflow to fall to the Devin-only tier. But the production claude-code-action review actually landed ~5 min later at 07:14:43Z. Falling to Devin-only would have discarded the primary signal (the exact slang#12064 `harvest_used=0` miss).

**Root cause:** Exit 22 (the "review bot still running" path that says WAIT-and-re-harvest) keys on `pending_bot` being populated in harvest.json — a Claude/review *check-run* or CodeRabbit *commit status* the script recognizes. On a freshly-opened PR the production review job can be in flight as a check-run named **`review`** (status `in_progress`, app `github-actions`) that the exit-20 branch did NOT classify as `pending_bot`, so it returned 20 (skip) instead of 22 (wait). The timing window between "PR opened / approver woken" and "review posted" is ~5 min.

**How to catch it:** Before accepting ANY harvest exit 20 (no bot review) on an `opened`/`ready_for_review` PR, independently check the head's check-runs for an in-flight review signal:
`gh api repos/<owner>/<repo>/commits/<sha>/check-runs --jq '.check_runs[] | select(.name=="review" or (.name|test("[Cc]laude|[Rr]eview"))) | {name,status,conclusion}'`
Also list PR reviews directly (`github_get_pull_request_reviews` MCP, or `gh pr view --json`) — a `github-actions[bot]` COMMENTED review at the head is the primary signal even if collect-reviews.sh raced it. If a `review` check-run is `in_progress` (or a review at head appears), WAIT ~30s and re-harvest; do NOT treat exit 20 as terminal. Only fall to Devin-only after the review signal settles absent.

**Fix (behavioral, no code change needed here):** Treat exit-20 as provisional on fresh PRs — the tell is an `in_progress` `review` check-run at head. Re-harvesting after it completed flipped 20→0 (primary tier) and gave the real verdict. Consider teaching collect-reviews.sh to fold an `in_progress` check-run named `review` into `pending_bot` so it returns 22 (wait) rather than 20 (skip).

**Generalizes:** a negative result from a collector that races an asynchronous producer is provisional — probe the producer's own liveness signal (here: the check-run) before acting on the absence. An absence claim that races a producer decays.
