---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-23T04:11:36.883Z
---

# falcor-build-approval-gate WAITING blocks reruns of ANY job in the same run, not just itself

Discovered 2026-09-23 on PR #12208: `test-windows-debug-cl-x86_64-gpu-dx / test-slang` (job 107017999728, run 35808237458) failed with the classic self-hosted-runner-lost-communication annotation — a textbook intermittent infra flake that should be rerunnable.

But the run also contains `falcor-build-approval-gate` sitting in `status:"waiting"` (pending manual approval). Both rerun paths fail as a result:
- `gh run rerun 35808237458 --repo shader-slang/slang --failed` → `run 35808237458 cannot be rerun; This workflow is already running`
- `gh run rerun --repo shader-slang/slang --job 107017999728` → `job 107017999728 cannot be rerun`

Root cause: GitHub Actions treats the whole run as non-`completed` (still `in_progress`/`waiting`) as long as any job in it is `waiting`, and the rerun-failed-jobs / rerun-single-job APIs both require the run to have reached a completed state first. So a falcor-gate wedge doesn't just block itself — it blocks rerunning *every other failed job in that same run*, even genuinely intermittent ones unrelated to the gate.

Actionable takeaway for the babysitter: when you find an intermittent-looking failure on a PR that also carries a known falcor-build-approval-gate WAITING entry (gate 0c), don't bother attempting `gh run rerun` — it will always be rejected while the gate is pending. Classify as `intermittent-but-gate-wedged`, log via `sweeplib.touch_tracker_verdict(verdict="gate-wedged")` + `append_row(action="note", result="left")`, and revisit once the gate clears (approved/rejected) — at that point the run can complete and a normal rerun becomes possible.
