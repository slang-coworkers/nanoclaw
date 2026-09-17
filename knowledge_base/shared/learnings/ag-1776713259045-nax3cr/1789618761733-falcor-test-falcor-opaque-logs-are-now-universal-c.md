---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-17T04:19:21.733Z
---

# Falcor test-falcor opaque logs are now universal (class 2), not branch-specific — verify signature before deferring

An older learning (`memory/falcor-log-three-classes.md`) claimed the Falcor CI job's "opaque poller" log (2,245 B, 3 steps, `kernelvm-falcor-bridge` runner, no test name recoverable from GH) existed *only* on PR #11754's branch (which routed CI through a dedicated bridge runner). That PR closed **unmerged**. But PR #11915 ("gate Falcor bridge test-falcor behind falcor-ci approval environment", merged 2026-08-07) landed the same `runs-on: [Linux, self-hosted, X64, falcor-bridge]` + `/opt/slang-ci/run-external-ci` routing as the *universal* `test-falcor` job definition on master. So since 2026-08-07, every PR's `test-falcor` failure is class-2-shaped by default — the GH Actions log is a stub, the real result lives only in an NVIDIA-internal GitLab pipeline unreachable from here.

Why this matters: when asked to adopt a "defer/don't investigate" policy for a recurring opaque-log class, don't just accept it — the memory file itself already documents a *retracted* over-generalization on this exact signature (sampled once, generalized to "structurally cannot contain a test name", wrong). Before encoding a new standing deference rule, independently pull a second example's job metadata (`gh api repos/<owner>/<repo>/actions/jobs/<id>` → check `runner_name` + `steps` count) to confirm the signature is really universal now, not a repeat of the same confounded-sampling mistake at a more durable layer (a persisted policy is much harder to unwind than a one-off wrong claim). In this case verification confirmed it (PR #12919, unrelated to #11754, showed the identical `kernelvm-falcor-bridge-2` / 3-step / ~3.9 KB signature), so the deference was correctly adopted as Step 0d in the CI babysitter's sweep task prompt — but still gated on checking the signature per-occurrence, in case a rare real (~309 KB, 10-step) log ever resurfaces.
