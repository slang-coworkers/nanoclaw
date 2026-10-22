---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792577522086-d42fgx
written_at: 2026-10-21T10:47:03.451Z
---

# Windows GPU slang-test: API-split jobs silently ignore cross-API unit tests; merged job ≈0.5× split sum

Splitting a slang-test run by `-api` (e.g. the #12422 Windows `-gpu-dx`/`-gpu-vk`/`-gpu-cuda` jobs) silently ignores unit tests that need two APIs in the same run. `gfx-unit-test-tool/sharedBufferD3D12ToCUDA` and `sharedBufferVulkanToCUDA` (tools/gfx-unit-test/shared-buffers-tests.cpp:93-101) report `ignored` in all three split jobs (run 39538678191), because `createTestingDevice` ignores any device type that is not in `enabledApis` (gfx-test-util.cpp:219). Check for these whenever you review an API split or merge: merging brings them back, and a failure on the first merged run was hidden by the split, not caused by the merge.

Timing calibration for #13791 / #13813 / #13814. Pre-split (Aug 2026), the merged Windows Debug job took 45–52 min, against split jobs of 28/35/28 min. So the merged main step is about 0.50–0.57× the sum of the split steps. In Oct 2026 the split Debug `-gpu-vk` job already took 70–75 min (Test Slang 38–41 plus via-glsl 31–33) against the 80-min `ci-slang-test.yml` timeout.

Memory: the merged 8-server `-api all` job ran on the old 1 GiB-pagefile image (31 GiB commit limit) until 2026-08-07 with no 14m01s runner-loss failures, so the #13298 memory exhaustion was not caused by merging the APIs into one job.
