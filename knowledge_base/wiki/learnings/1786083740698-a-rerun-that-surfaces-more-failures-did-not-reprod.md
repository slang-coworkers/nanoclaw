---
title: "A rerun that surfaces MORE failures did not reproduce them — compare per-JOB, never per-run conclusion"
type: learning
topic: agent-ops
source: learnings/1786083740698-a-rerun-that-surfaces-more-failures-did-not-reprod.md
---

# A rerun that surfaces MORE failures did not reproduce them — compare per-JOB, never per-run conclusion

Observed 2026-08-07 on shader-slang/slang #11709, CI run 31119388554.

Attempt 1: `conclusion=failure`, **1** failing job. Attempt 2 (after a rerun): `conclusion=failure`, **4** failing jobs. Same `head_sha`. The naive read — "reran it and it failed again, therefore it reproduces, therefore it's a real regression" — is exactly backwards here.

What actually happened: attempt 1's `filter` job was never acquired by a runner (`runner_name: ''`, `runner_id: 0`, **0 steps**, annotation *"The job was not acquired by Runner of type hosted even after multiple attempts"*, log = **215 bytes / HTTP 404 BlobNotFound**). Every `needs: [filter]` job therefore `skipped`. Four-way bucket of attempt 1: **0 success, 1 failure, 35 untested**. Attempt 1 tested *nothing*; its only "failure" was the `check-ci` aggregator reporting `filter: abandoned`.

Attempt 2 got 32 legs green and surfaced 3 genuinely independent failures on jobs attempt 1 never reached (a sanitizer job killed by *"The hosted runner lost communication with the server"*, a tracked Falcor access violation, and a single JSON-RPC test red). **Zero overlap** with attempt 1. The rerun did not reproduce a failure — it *revealed masked results*.

**The rule:** reproduction is a claim about a **signature on a job**, not about a run's rolled-up `conclusion`. Before saying "it failed again", diff the *failing-job sets* of the two attempts. If the earlier attempt's failure was only the `check-ci`/aggregate job, or its jobs have `steps == 0`, then that attempt established **no baseline at all** and no reproduction claim is available in either direction.

**Why it matters asymmetrically:** this error pushes toward "legitimate regression → don't rerun → leave a green PR red", and it is *self-confirming* (more failures = feels like stronger evidence). The cheap detector: **count failing jobs per attempt; if the count went UP, ask what the earlier attempt actually executed.**

Corollary confirmed the same sweep: `run_attempt > 1` is no evidence of anything by itself, and `gh run rerun` returns `rc=0` without incrementing the attempt — probe `run_attempt` against a pre-recorded baseline to confirm a rerun actually took.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786083740698-a-rerun-that-surfaces-more-failures-did-not-reprod.md`_
