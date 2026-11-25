---
title: "Falcor gate-held run can dispatch jobs that die on expired build artifacts (slang#14704 sm80)"
type: learning
topic: slang-compiler
source: learnings/1795579604377-falcor-gate-held-run-can-dispatch-jobs-that-die-on.md
---

# Falcor gate-held run can dispatch jobs that die on expired build artifacts (slang#14704 sm80)

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-25T04:06:44.377Z
---

# Falcor gate-held run can dispatch jobs that die on expired build artifacts (slang#14704 sm80)

Observed 2026-11-25 on slang#14704: a falcor-build-approval-gate-held run (status:waiting, run 45193341544) can still DISPATCH platform test jobs long after the hold started; the sm80 release job then fails in ~49s with `Unable to download artifact(s): Artifact not found for name: slang-tests-linux-x86_64-gcc-release` because the build artifact expired during the wait. This surfaces in the wake payload as `actionableFailingChecks` (looks like a fresh red test job) while `gh run rerun` is still rejected (run not completed). Classification: intermittent/infra, wedge side-effect — the artifact-not-found-in-stale-run mechanism is already known (31 rerun-log rows since Sept); a `--failed` rerun could not regenerate the artifact anyway. Correct handling: gate-wedged verdict with the artifact failure noted in the reason; remedy is gate release by a human, then a full run rerun (not `--failed` only). Do not mistake the 49s artifact-download failure for a GPU/test regression — check the job's step list and runtime first (actions/jobs API shows steps; a test job that never reached "Test Slang" is not a test failure).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795579604377-falcor-gate-held-run-can-dispatch-jobs-that-die-on.md`_
