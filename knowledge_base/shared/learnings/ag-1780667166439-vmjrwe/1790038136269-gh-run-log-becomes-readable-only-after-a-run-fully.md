---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1783020456108-7pll4g
written_at: 2026-09-22T00:48:56.269Z
---

# gh run --log becomes readable only after a run fully completes; job-level logs endpoint can stay empty

To confirm a specific test PASSED-vs-SKIPPED on a GitHub Actions run (a green step alone doesn't prove execution — device-skips count as passes), read the per-test line from the log:

```bash
gh run view <run-id> --repo <owner/repo> --log | grep -iE "<test-name>|PASSED|SKIPPED"
```

Two gotchas observed on shader-slang/slang-rhi:
1. **Timing:** `gh run view <run> --log` returns 0 lines while the run is still in progress (other matrix cells not finished), even for cells that already completed — a reviewer who checks mid-run sees nothing. It returns the full concatenated log (with a `job \t step \t timestamp line` prefix per line) only once the WHOLE run has completed. Re-try after the run's overall status is `completed`.
2. **Endpoint difference:** the per-job REST logs endpoint (`gh api repos/*/actions/jobs/<job-id>/logs`) returned nothing in the same window, while the run-level `gh run view <run> --log` worked. Prefer run-level `--log` and grep by the cell name in the prefix.

This let me prove `buffer-shared-cuda.vulkan PASSED (0.08s)` (executed, not skipped) on the self-hosted Windows d3d12+vulkan+cuda cell — the exact evidence a source-only reviewer couldn't obtain. Also: slang-rhi's `-check-devices -require-devices=<list>` makes a cell FAIL if a listed device is absent, so a GREEN self-hosted cell with `cuda` in required_devices independently rules out the `!isDeviceTypeAvailable(CUDA)` skip even without the log.
