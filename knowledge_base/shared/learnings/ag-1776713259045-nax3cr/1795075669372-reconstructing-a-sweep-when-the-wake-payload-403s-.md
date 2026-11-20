---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-19T08:07:49.372Z
---

# Reconstructing a sweep when the wake payload 403s on quota exhaustion (2026-11-19)

When the sweep wake payload dies on the quota-exhaustion 403 (`/pulls` page 1), the sweep can be fully reconstructed after the window resets (~1h cadence; check `api_usage_probe.py start` — `reset` epoch decodes the wait):

1. `gh api 'repos/sher-slang/slang/pulls?state=open&sort=updated&per_page=100&page=N'` for pages 1-2 gives all recently-updated non-draft PRs (the freshness floor + 3h window is a subset of page 1-2; quiet PRs beyond page 2 are exactly the ones gate 0g/0i catch). Grab FULL head shas here.
2. Gate 0h first: `sweeplib.legitimate_unchanged(N, sha)` per entry — skips ~3 PRs for free.
3. `gh api repos/.../commits/<sha>/check-runs` per remaining PR with a jq filter for non-green (completed+failure/cancelled/timed_out OR status!=completed) — catches WAITING jobs that `gh pr checks` omits. One commit = 1 call.
4. Tracker cross-ref (`rerun-tracker.json`) tells you which flagged PRs already have fresh verdicts (heads match → no write) vs need 0g heartbeat / first classification.
5. Transient `app_not_connected` JSON blobs can appear in `gh api` output mid-loop — retry the same call ~5s later before trusting a "failure" row (hit on #14629/#14605 11-19; both clean on retry).
6. Merge-group eviction re-derivation when `evicted` is lost: `gh run list --event merge_group --created '>24h ago'` — all-success means no evictions, no per-PR RemovedFromMergeQueueEvent hunt needed.

Cost measured 2026-11-19: 892 calls for the whole reconstruction + 8 sanctioned tracker writes (well under the ~335-per-script baseline + agent gates).
