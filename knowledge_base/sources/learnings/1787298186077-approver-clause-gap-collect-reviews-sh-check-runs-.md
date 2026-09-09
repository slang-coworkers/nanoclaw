---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787297633987-simi2i
written_at: 2026-08-21T07:43:06.077Z
---

# [approver/clause-gap] collect-reviews.sh check-runs fetch is NOT paginated — false exit-20 skip on PRs with >30 check-runs

## Symptom
On shader-slang/slang PR #12679 (a fresh, reviewable PR), `collect-reviews.sh` returned **exit 20**
("no harvestable bot review AND none pending → Devin-only") while the production **Claude PR Review**
check-run (`name="review"`, workflow "Claude PR Review") was still **IN_PROGRESS** on the head. Exit 20
sends the workflow to the Devin-only fallback and discards the primary signal — the exact
slang#12064 `harvest_used=0` miss. The correct code was **exit 22** (WAIT for the pending bot, re-harvest).

## Root cause
`collect-reviews.sh:62` fetches the pending-detection input WITHOUT `--paginate`:
```
gh api "repos/$REPO/commits/$COMMIT/check-runs" >"$TMP/checkruns.json" 2>/dev/null || true
```
GitHub's check-runs endpoint returns **30 per page**. This PR had `total_count=51`. The in-progress
`review` run sat on page 2, so the script's `pending_bot()` (`:158-169`, which scans
`check_runs[].status in (queued,in_progress)` matching `/coderabbit|claude|review/i`) saw an
incomplete first page, found nothing pending, and fell through to the genuine-skip branch (exit 20).
The `/commits/$COMMIT/status` endpoint it also reads only carries CodeRabbit/CLA statuses — the
Claude review reports as a **check-run**, not a commit status, so status.json couldn't rescue it.

The reviews call at `:60` DOES use `--paginate`; only the check-runs (and arguably status) call was missed.

## How to catch it
Before accepting ANY exit 20 on a fresh/reviewable PR, independently check the PR's check-runs
**paginated**:
```
gh api --paginate "repos/OWNER/NAME/commits/<head>/check-runs" \
  --jq '.check_runs[] | select(.name=="review" or .status!="completed") | {name,status,conclusion}'
```
or read the GraphQL `statusCheckRollup` (which is not page-capped). If a `review` / claude / coderabbit
run is `in_progress`/`queued`, treat it as exit **22**: poll the run to `completed` (~30s cadence, ~6min cap),
then re-run `collect-reviews.sh`. A non-paginated "nothing pending" is a fall-through negative — the
least trustworthy result a check can produce (nothing had to succeed for it to print).

## Fix
Add `--paginate` to `collect-reviews.sh:62` (and `:61` status for symmetry). Until then, the manual
paginated check above is the guard. `total_count` vs first-page length (30) is the tell that a page was truncated.

Verified 2026-08-21 on PR #12679: paginated fetch showed `review` in_progress; waited 210s → SUCCESS;
re-harvest returned exit 0 with the primary `github-actions[bot]` review at the pinned head.
