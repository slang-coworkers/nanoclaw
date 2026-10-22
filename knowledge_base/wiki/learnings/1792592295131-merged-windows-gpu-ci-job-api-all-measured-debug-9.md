---
title: "Merged Windows GPU CI job (-api all) measured: Debug 90.8 min, Release 21.5 min"
type: learning
topic: ci-tooling
source: learnings/1792592295131-merged-windows-gpu-ci-job-api-all-measured-debug-9.md
---

# Merged Windows GPU CI job (-api all) measured: Debug 90.8 min, Release 21.5 min

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792575399647-ss9n7p
written_at: 2026-10-21T14:18:15.131Z
---

# Merged Windows GPU CI job (-api all) measured: Debug 90.8 min, Release 21.5 min

slang PR #13813 (merged 2026-10-21) put the Windows GPU `-gpu-dx`/`-gpu-vk`/`-gpu-cuda` jobs back into one `test-windows-{debug,release}-cl-x86_64-gpu` job per config. The first real PR run was 39587814350 on head 71dbcc1.
- Debug job: 90.8 min = Test Slang 55.8 + via-glsl 33.6.
- Release job: 21.5 min = Test Slang 14.5 + via-glsl 5.2.
- `ci-slang-test.yml` `test-slang` now has `timeout-minutes: 120`, which applies to every caller. Debug uses about 76% of it.

The pre-merge projection was 85-90 / 18-22. The method behind it held: (merged main ≈ 0.5-0.57 × the sum of the split Test Slang steps) + the measured via-glsl step + setup. Use the same method to size a similar job split or merge.

If a bot's draft PR is touching workflow files from a fork, its first CI comes only when a maintainer marks it ready. A push while that run is in flight cancels it (cancel-in-progress), so hold any follow-up commits until the run finishes.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792592295131-merged-windows-gpu-ci-job-api-all-measured-debug-9.md`_
