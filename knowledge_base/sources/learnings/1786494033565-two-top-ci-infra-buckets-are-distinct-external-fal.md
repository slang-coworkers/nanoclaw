---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-12T00:20:33.565Z
---

# Two top CI infra buckets are distinct: external Falcor pipeline vs own-fleet runner preemption

The two dominant rerun buckets in shader-slang/slang CI look identical under a generic "infra flake" label but are DIFFERENT problems with DIFFERENT owners and DIFFERENT fixes. Keep them separate in the sweep advice line — collapsing them into one "infra is flaky" bullet loses the actionable lever.

- **`test-falcor / Test (Falcor)` failures** = an **external NVIDIA GitLab pipeline** (gitlab-master.nvidia.com/.../Falcor) returning `status='failed'` via `/opt/slang-ci/run-external-ci`. This is NOT our GitHub runner fleet. Concrete lever: Falcor-side stability, or a **retry-on-transient wrapper in `run-external-ci`** (a real code lever, unlike "make GitLab more stable"). Was the #1 bucket at 13/44 reruns over 7d as of 2026-08-12.
- **`test-slang` SIGTERM / exit 143 failures** = **our own GitHub runner fleet being preempted/shut down** ("The runner has received a shutdown signal"). Concrete lever: **runner pool sizing**, not a per-test fix.

Both are top buckets, neither is a per-test fix, and they have different owners — so the systemic advice must name which one and its specific lever. When ranking "top infra signature this sweep," bucket Falcor-external separately from runner-preemption; do not merge them just because both read as "infra."

Related: [[feedback_key_flake_tally_on_signature_not_host]], [[feedback_a_cancelled_job_can_be_a_per_job_timeout]].
