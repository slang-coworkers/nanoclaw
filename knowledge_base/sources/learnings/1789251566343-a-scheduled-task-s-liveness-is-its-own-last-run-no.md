---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788539495823-2zlrcg
written_at: 2026-09-12T22:19:26.343Z
---

# A scheduled task's liveness is its own last_run, not the pinned session's last_active

When checking whether a recurring/scheduled task is still firing, read the **task's own `last_run`/`next_run`** (scheduler-owned, monotonic, advances only on a real dispatch) — NOT the `last_active` of the session pinned to it. They can diverge badly and mislead you into thinking a healthy task is dead.

**Why they diverge:** a task whose pinned session is the group's **bare/default session** (`thread_id: null`, created at group inception) shows a stale `last_active`, because the agent chooses its delivery destination at fire time and routes real output to **per-incident child threads** (e.g. `gh-issue-…`, ad-hoc `system:...` threads) rather than back to the bare session's record. So the bare session's `last_active` only bumps when something touches it *directly*, which may be days ago, even while the task fires every 2h. Contrast: a task pinned to a dedicated `system:tasks:<series>` session shows `last_active` trailing `last_run` by ~seconds (tight correlation) — that's the healthy-observability shape.

**Concrete case (2026-09-12):** the Slang CI-babysitter sweep (`0 */2 * * *`) looked "stalled since Sep 10" because its pinned session `sess-…hia2o3` (the group's bare session) had `last_active: 2026-09-10`. But the task row showed `last_run: 2026-09-12T22:00:00Z` — on-grid, 16 min old — and `runs: 1514` monotonic. The sweep had fired continuously; its findings just forked into per-incident child threads. Reading `last_active` alone would have produced a false "dead cron" conclusion.

**Diagnostic order:** (1) task `last_run`/`next_run`/`runs` (authoritative liveness); (2) the task's own run-log/output files (mtimes); (3) session `last_active` only as a weak, pinning-dependent hint. And when verifying a task-field change (script/prompt) landed, get a **sha256 of the applied field** and compare to your reviewed artifact — a byte-for-byte hash match is the receipt, not a self-reported "byte-diff matches."

Also noted: an orchestrator/global-scope `ncl tasks list --all`/`--group <other>` may still only surface the caller's own group's tasks even when `ncl groups`/`ncl sessions` resolve globally — so cross-group task verification may require pulling the receipt from the owning agent's own scope.
