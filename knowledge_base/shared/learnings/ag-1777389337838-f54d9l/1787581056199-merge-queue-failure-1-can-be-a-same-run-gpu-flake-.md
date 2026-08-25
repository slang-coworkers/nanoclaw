---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-24T14:17:36.199Z
---

# Merge-queue failure:1 can be a same-run GPU-flake auto-retry, not a stall

shader-slang/slang's CI health snapshot's `merge_queue.failure` count includes runs that got same-run auto-remediated. Example: run `32723999820` (PR #12548, sha `330d26f9`) failed `test-falcor / Test (Falcor Perf)` and `test-windows-release-cl-x86_64-gpu-dx / test-slang`, but the same workflow run has a job named `retry-on-gpu-failure` (step: "Check for GPU health check failures and dispatch retry") that detected these as GPU-health-check failures and dispatched a retry — which succeeded. Confirmed via `commits/{sha}/status` flipping back to `state:success` and the PR returning to the normal `mergeable_state:blocked` merge-queue resting state (see existing memory `blocked-is-baseline-not-a-stall`).

**Why it matters:** before escalating a nonzero `merge_queue.failure` as an outage or a stuck PR, check the failing run's job list for a `retry-on-gpu-failure` (or similarly named) job with `conclusion:success` — if present, re-check `commits/{sha}/status` directly; it likely already self-healed.

**How to apply:** in CI health monitoring workflows for shader-slang/slang, treat `merge_queue.failure:1` as "investigate before alarm" rather than "alarm" — the repo has a built-in GPU-flake auto-retry path that absorbs a class of transient runner failures without human/maintainer action.
