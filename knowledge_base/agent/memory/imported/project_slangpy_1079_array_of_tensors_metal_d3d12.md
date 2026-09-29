---
name: project_slangpy_1079_array_of_tensors_metal_d3d12
description: "slangpy#1079 array-of-tensor params: two independent defects. D3D12 device-removal (clear-at-creation on non-UAV) FIXED by PR #1080 (Tensor::clear raises on read-only storage; ccummingsNV APPROVED; non-draft, OPEN @ 03893de5 as of 09-28). Metal wrong-results NOT started, routed to slang#12291. Issue stays open until both backends are green and the skips are re-enabled."
metadata: 
  node_type: memory
  type: project
  originSessionId: a4a1751c-a713-4c56-adb1-93f9860a283f
---

# slangpy#1079: arrays of tensor params (Metal wrong results, D3D12 device removal)

nv-slang-bot filed this as a follow-up while carrying #996 → **#1078**. #1078 added the array-of-tensor and tensor-in-struct-vectorize tests but **skipped them on Metal and D3D12**, with this issue as the reference. #1078 squash-merged on 08-05 (`507b4cf1`). Repro: `slangpy/tests/slangpy_tests/test_array.py::{test_array_of_tensors_read, test_array_of_rwtensors_write, test_array_of_difftensors_read, test_array_of_rwdifftensors_write, test_vectorize_struct_with_tensor_array, test_2d_mapped_vectorize_struct_with_tensor_array}`.

**State (gh-verified 2026-09-28):** issue #1079 is OPEN. PR #1080 is **non-draft, `reviewDecision: APPROVED`, OPEN, base `main`, head `03893de5`**, which is past the 08-05 rebase head `3d50ffc2`. The remaining hop is the maintainer's merge. The Metal track is separate. #1079 closes only when both backends are green and the per-backend skips are re-enabled.

## Defect 1: D3D12 device removal (root-caused, fixed by #1080)

**Cause:** `Tensor.zeros(usage=shader_resource)` → `tensor_zeros()` calls `tensor->clear()` unconditionally at creation (`src/slangpy_ext/func/tensor.cpp:442`). A D3D12 `clear_buffer` needs a UAV, so `ClearUnorderedAccessViewUint` on a buffer with shader_resource usage only fails, calls `RemoveDevice`, and poisons the whole worker (slang-rhi `d3d12-command.cpp:437-445`). Vulkan and CUDA clear through transfer ops, so they pass. **The root is at creation, not dispatch**, contrary to the issue's narrative.

**Load-bearing constraint:** read-only tensor *arrays* legitimately need shader_resource-only storage. Adding a UAV renames the element type, and `array.py` compares element types by the `full_name` string, so array resolution would break on every backend. The fix therefore can't add a UAV.

**Fix path:**
1. **Copy-path zeroing at the `Tensor::clear()` chokepoint (`98394f3`).** The reviewer approved it and caught a PR-introduced regression along the way: a non-`device_local` read-back tensor would throw, so the fallback was gated on `device_local`.
2. **ccummingsNV requested changes on 07-31:** a full-size host alloc plus staging plus a GPU copy per clear is too expensive for large tensors.
3. **Pivot to raise-on-misuse (`1424924`).** `Tensor::clear()` now **raises** when storage lacks `unordered_access` ("clearing is a write"). That rejects the call before any GPU op, so the invalid UAV clear is never issued. It also satisfies issue ask #2 (a clean error instead of device loss). Consequence: `Tensor.zeros(shader_resource)` and `zeros_like` now raise, and read-only inputs are built with `Tensor.empty()` + `copy_from_numpy`.
4. **Round 2 (`f9b1b14`)** trimmed comments and removed the survivor assertions. It also **removed the 2 D3D12 read-test skips #1078 added.** That removal is intentional: don't "restore" them as a rebase artifact. Those 2 tests keep read-only inputs deliberately, because a writable input fails resolution against a read-only `Tensor[]` param (RWTensor ≠ Tensor by name). The fixer verified this empirically. **ccummingsNV APPROVED on 08-03.**

**Ask #2 needed no new guard.** The array path raises `ResolveException` (`callsignature.py:29`, re-raised in `calldata.py`), and the scalar path raises `TypeError` (`tensorcommon.py:140-143`). Both fire during kernel generation, before any GPU op. `SlangPyError` doesn't exist in the codebase; only AGENTS.md mentions it.

**Tests:** 4 regression tests (`test_clear_read_only_tensor_raises`, `test_clear_writable_tensor_via_command_encoder`, `test_read_only_tensor_to_writable_param_raises_cleanly`, `test_array_of_read_only_tensors_to_rwtensor_array_raises_cleanly`). `test_array.py`: 44 passed, 2 skipped on Vulkan and CUDA. `test_clear_read_only_tensor_raises` is the direct D3D12 regression test. **It had never run on D3D12 while #1080 was stacked on draft #1078**, because full CI doesn't trigger on a draft stacked on a draft. That gap is why Main kept the ready-flip operator-gated on 08-03. Approved + green on Linux does not verify a D3D12-only failure mode.

## Defect 2: Metal wrong results (not started)

The same kernel is correct on Vulkan and CUDA and wrong on Metal. The working hypothesis is upstream Slang Metal codegen, now tracked as slang#12291 ([[project_12291_metal_uniform_array_of_resource_unbound_arg]]). The tensor-in-struct subset may instead be a slangpy marshalling-offset issue: check open PR #1045 first. The 6 Metal skips stay in place. **Guardrail:** the upstream-Slang call is a hypothesis until someone reproduces it on-device. Escalation routes through Main → slang-triager, and slangpy-triager doesn't file it directly on shader-slang/slang ([[feedback_never_relay_a_verdict_not_in_hand]]).

## Durable lessons

- **A squash-merge of the base breaks a stacked PR in two independent ways.** First, the carrier commits are duplicated under different SHAs. Second, a stale base makes the net diff silently revert unrelated merged work: pre-rebase, #1080 showed 50 files and 4068 deletions. `--json commits` exposes the first and is blind to the second, so only the net `--stat` catches it. The general rule lives in [[project_stacked_pr_shared_base_clobber]].
- **Rebase proof pattern:** take a backup tag, then prove the carrier commits are redundant (`main`'s file is byte-identical to the carrier end-state). Rebase with `--onto`. Check that `git diff backup HEAD -- <files>` is empty. If `--force-with-lease` is rejected as "stale info", fetch, confirm the remote head equals your backup, and pin the lease to that SHA. Never fall back to plain `--force`. Re-test against a **freshly rebuilt** `.so`.
- **A force-push dismisses an existing approval.** CI went 12/12 green after the rebase, yet `reviewDecision` flipped to REVIEW_REQUIRED (ccummingsNV DISMISSED). `mergeStateStatus: BLOCKED` changed meaning from "draft + CI incomplete" to "draft + missing review" under the same string. Decompose a composite status every time, and count the re-approval cost when deciding to rebase an approved PR.
- **Answer separability from `git diff`, not memory.** Rebasing #1080 onto `main` looked like a trap, but the diff showed the fix plus its 4 tests were standalone. Only 4 hunks, which adapt #1078's read tests, depended on #1078. That flipped Main's operator recommendation.
- **An intermittent GraphQL 401 with REST still working is a watch item, not an escalation.** Escalate only if it persists, spreads to other coworkers, or blocks a push. See [[project_github_actions_graphql_401_outage]], [[feedback_missing_artifact_not_outage_until_push_confirmed]], and [[feedback_gh_auth_status_misleading]].
