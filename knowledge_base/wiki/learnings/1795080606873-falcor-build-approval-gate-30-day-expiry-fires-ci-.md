---
title: "falcor-build-approval-gate 30-day expiry fires ci_failed on parked drafts — triage as no-op, never requeue"
type: learning
topic: agent-ops
source: learnings/1795080606873-falcor-build-approval-gate-30-day-expiry-fires-ci-.md
---

# falcor-build-approval-gate 30-day expiry fires ci_failed on parked drafts — triage as no-op, never requeue

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790881765830-saa1xb
written_at: 2026-11-19T09:30:06.873Z
---

# falcor-build-approval-gate 30-day expiry fires ci_failed on parked drafts — triage as no-op, never requeue

On shader-slang/slang, a bot draft yielded behind `wait-for-human-priority` gets a `ci_failed` webhook when its `falcor-build-approval-gate` expires — this is NOT a regression and NOT requeueable. Verified twice (Nov 2026):

**Mechanism.** A priority-yielded draft has all build/test jobs `skipped` (none ever run); `wait-for-human-priority` and `check-ci` conclude `failure` immediately at yield time. The `falcor-build-approval-gate` check then runs exactly 30 days from its start and finalizes as `failure` on expiry, flipping the suite conclusion to failure — which fires a `github.ci_failed` webhook to the chain owner. Example: PR #13400 (parked since 10-20) — gate started 2026-10-20T09:26:10Z, concluded failure 2026-11-19T09:26:11Z; 50 check runs = 46 skipped / 3 failure (the priority-gate trio) / 1 success; zero build/test jobs ever ran on the head.

**Decision table for a ci_failed webhook on an old/parked bot draft:**
- Read the suite's check-runs with AUTHENTICATED calls first. If all real build/test jobs are `skipped` and the failures are the priority-gate trio (`wait-for-human-priority`, `check-ci`, `falcor-build-approval-gate`), it is yield/gate-expiry → do nothing. The only unblock is a human prioritizing the draft (already escalated via the review chain for known parked PRs).
- Do NOT requeue: nothing ran, so a rerun targets a nonexistent run, and force-running CI on a still-parked draft just re-skips.
- Distinguish from the stale-backlog replay case (slang#13384, 11-16): there the delivered suite and run IDs returned 404 (deleted by GitHub's ~30-day retention) and zero check runs existed on the head at all. 404 suite = deleted-event replay; live suite with skipped jobs = gate expiry/yield.
- Unauthenticated API reads gave false negatives during the 2026-11-16 credential outage (`actions/runs?head_sha=` total_count 0 while a run demonstrably existed). Do not classify CI state from unauth reads.

**Expect more of these:** every bot draft parked ≥30 days behind the priority gate fires one on its gate's 30-day anniversary. Triage is one read-and-close turn; keep it minimal on cost-escalated owner sessions.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795080606873-falcor-build-approval-gate-30-day-expiry-fires-ci-.md`_
