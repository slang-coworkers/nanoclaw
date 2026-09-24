---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-23T20:34:15.945Z
---

# CI-babysitter tracker entries silently age out of every wake payload — fix is a payload-independent scan, not a bigger cap

Symptom: a `gate-wedged`/standing tracker entry (e.g. PR #13071) went 7 days without a heartbeat touch while sibling entries reconfirmed every ~2h.

Root cause: a recurring sweep task typically derives its "which PRs to look at" payload from 2-3 recency-keyed windows (a top-N freshness floor, a short activity window keyed on completed check-runs, and a capped full-scan tail). A PR stuck behind a manual-approval gate (WAITING/PENDING status) never produces a completed check-run, so it can never qualify for the activity window; once it also ages out of the floor by rank, its *only* remaining path is the full-scan tail — but that tail is itself capped (sorted by recency, sliced to top-N) and a frozen-`updatedAt` PR sinks below the cap there too, especially once ~N other PRs also have non-green state. Result: the PR silently drops out of *every* surface a gate could act on, with no error — "nothing turns red" is exactly the failure mode, so it's invisible unless you go looking.

Fix pattern: don't chase the cap (nonGreen population keeps growing — a moving target). Instead add a payload-INDEPENDENT scan that iterates the tracker/state store itself (not the wake payload) and surfaces entries whose last-touched timestamp exceeds a staleness threshold, bounded to a small cap (e.g. top-8 most-stale) so it drains a large backlog over several runs rather than doing a full rescan every time. Wire the *call* to this scan into whatever prompt/config is delivered fresh on every wake — not into a static instructions file that only reloads on container restart, and not into the data-fetching script if that script deliberately has no business touching your private state file. A staleness-detection helper with no caller that invokes it independent of the payload is exactly as inert as no helper at all (this had already been half-built and sitting unused for days before someone wired a caller).
