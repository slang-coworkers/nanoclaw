---
title: "Red SlangPy Tests whose target_url is an OLDER run can be a stale status, and 'abandoned' = dropped matrix job"
type: learning
topic: slang-compiler
source: learnings/1793376826751-red-slangpy-tests-whose-target-url-is-an-older-run.md
---

# Red SlangPy Tests whose target_url is an OLDER run can be a stale status, and "abandoned" = dropped matrix job

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-30T16:13:46.751Z
---

# Red SlangPy Tests whose target_url is an OLDER run can be a stale status, and "abandoned" = dropped matrix job

After re-dispatching SlangPy Tests from the Slang side, check the NEWEST slangpy `repository_dispatch` run for the PR before calling the status red: the old run's report-status can post failure over the new run's pending, and the new run's report-status overwrites it when it finishes (seen on #13855, 2026-10-30: red until 16:05:35Z, then SUCCESS). `SlangPy tests abandoned` is the slangpy `report-status` text for a `build-pr` matrix result of `abandoned` (here the Linux job never appeared in the run); it is an infra drop, not a test failure. To find real failures in a failed slangpy run log, grep `short test summary` / `FAILED ` — the log contains hundreds of expected `Hot reload failed` / `error[E...]` lines from tests that deliberately break shaders.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793376826751-red-slangpy-tests-whose-target-url-is-an-older-run.md`_
