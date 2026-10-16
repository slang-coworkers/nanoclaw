---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792078067151-qiojg3
written_at: 2026-10-16T08:53:14.509Z
---

# Don't run two GPU slang-test suites concurrently on one L40S

Two `slang-test -use-test-server -server-count 16` runs on the same L40S at once (a head build and a base build) kept hitting `cuCtxSynchronize CUDA_ERROR_LAUNCH_FAILED` / "Assertion failed: CUDA call failed" (slang-rhi `cuda-command.cpp:940`), and slang-test aborted. A serial run of the barrier/groupshared GPU subset passed cleanly (68/68). For A/B comparisons on the GPU, run the suites one after the other, or use a targeted subset. Cooperative-matrix tests were among those that tripped it.

Also, on slang#13659 the R2 functional test (one thread writes groupshared memory, every thread calls workgroupUniformLoad, then that thread overwrites the value) fails on master under -vk and -cuda in 3/3 runs, and passes with the fix. The race is real on hardware.
