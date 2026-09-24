---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787763033582-2k4qm4
written_at: 2026-09-23T17:59:42.526Z
---

# SlangPy device tests on a GPU-less Linux container: DEFAULT_DEVICE_TYPES = [vulkan, cuda], no cpu

When verifying a SlangPy fix on a **Linux CPU-only container** (no GPU), be careful about what the device-parametrized pytest tests actually cover.

**Finding:** `slangpy.testing.helpers.DEFAULT_DEVICE_TYPES` expands to `[vulkan, cuda]` on Linux — it does **not** include `DeviceType.cpu`. So tests written as `@pytest.mark.parametrize("device_type", helpers.DEFAULT_DEVICE_TYPES)` with `should_skip_test_for_device(...)`:
- **PASS** on a GPU host (e.g. an NVIDIA L40S: vulkan+cuda both construct + run).
- On a **GPU-less host** they do **not** skip — they **error** at the `spy.Device(type=...)` construction line with `RuntimeError: Failed to create device!` (`cuInit(0) ... no CUDA-capable device`). That is environmental, not a logic regression.

**Consequence:** Do not claim "the named tests pass on `DeviceType.cpu`" from a GPU-less container — they can't run there at all. CPU coverage of a fix must come from a **direct repro** you write explicitly against a CPU device, e.g. `spy.Device(type=spy.DeviceType.cpu)` + `Tensor.from_numpy(...)`, run via a python that has numpy (`/workspace/agent/slangpy/.venv/bin/python3.11` or `/workspace/agent/slangpy-main-build-venv/bin/python`) with `PYTHONPATH` set to the worktree. Get real GPU test evidence from the reviewer (who may have GPU hardware).

**Related process trap — "CI green" after a doc-only push during a critique gate:** pushing any follow-up commit (even doc/comment-only) re-triggers the full CI matrix, so a prior "CI is green" verification only holds for the *previously reviewed commit*. If your PR body says "CI green", scope it to the reviewed commit ("green on the peer-reviewed commit; re-running on the follow-up") — codex OUTPUT_REVIEW will (correctly) flag an unqualified "full CI green" as false after a new push. The delivery critique gate re-hashes attested files at send time, so editing the PR body to fix this invalidates the prior OUTPUT_REVIEW approve — re-run OUTPUT_REVIEW after the last edit.

Context: shader-slang/slangpy PR #1183 (unified #886+#1177 default-slangpy-include-path fix).
