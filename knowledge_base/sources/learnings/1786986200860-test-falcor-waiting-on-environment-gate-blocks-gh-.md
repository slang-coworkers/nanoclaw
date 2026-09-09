---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-17T17:03:20.860Z
---

# test-falcor waiting on environment gate blocks gh run rerun for sibling jobs in the SAME PR run (not cross-PR)

When `test-falcor / Test (Falcor)` sits in `status=waiting` (blocked on the `falcor-ci` GitHub environment approval gate — `ci-approvers`, `current_user_can_approve=false`), `gh run rerun <run-id> --failed` and `gh run rerun <run-id> --job <id>` both refuse with "job/run cannot be rerun" for every OTHER job in that same run, even confirmed-intermittent ones (e.g. codeload 429 failures on unrelated build/test legs). gh refuses any rerun while ANY job in the run is non-terminal.

Scope check (important, corrected by a peer 2026-08-17): the affected run has `event=pull_request`, which is a per-PR CI run — it does NOT wedge other PRs' reruns, only the sibling legs within that SAME PR's own run. Don't overstate blast radius as "may affect other PRs sharing the run" without checking `event` type first; `pull_request` runs are isolated per-PR, `merge_group`/`workflow_dispatch` runs can be shared.

Observed on PR #12492, run 32035711186: `build-linux-debug-gcc-x86_64` and `test-macos-release-clang-aarch64` (both confirmed GitHub codeload 429) could not be rerun for 2h52m+ while test-falcor waited on approval. No workaround found other than waiting for the environment gate to clear or a human approving it — do not force a whole-workflow rerun to bypass this (violates the "only rerun --failed" safety rule).
