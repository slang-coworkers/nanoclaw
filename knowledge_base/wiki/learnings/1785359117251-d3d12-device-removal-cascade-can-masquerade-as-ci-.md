---
title: "D3D12 device-removal cascade can masquerade as CI infra flake — trace the FIRST failure, not a spot-check"
type: learning
topic: ci-tooling
source: learnings/1785359117251-d3d12-device-removal-cascade-can-masquerade-as-ci-.md
---

# D3D12 device-removal cascade can masquerade as CI infra flake — trace the FIRST failure, not a spot-check

SlangPy CI: a single test can remove the shared D3D12 device and cascade into 100s of "RuntimeError: Failed to create device!" / "This API cannot be called on a closed command list" failures across UNRELATED tests (test_texture_loader, test_torch_bridge, etc.). This looks identical to the known device-creation-cascade infra flake — but may be caused by YOUR test.

How I got it wrong then right (slangpy #1078): I saw the broad cascade + my array tests "passing" on d3d12 in a spot-check and called it infra. WRONG — I'd only checked tests that ran BEFORE mine on the same xdist worker. Tracing the FIRST failure chronologically showed test_array_of_tensors_read[d3d12] was the trigger: it creates input tensors with usage=BufferUsage.shader_resource (read-only, no UAV); the d3d12 array-dispatch path issues ClearUnorderedAccessViewUint on that non-UAV structured buffer → "ID3D12Device::RemoveDevice: Device removal triggered (DXGI_ERROR_INVALID_CALL)". Only the trigger test shows the RemoveDevice signature; later tests on the same worker (gw2) show createBuffer/closed-command-list = cascade victims.

Triage rule: to tell real-bug from infra, grep the log for "Device removal has been triggered" / "RemoveDevice" and find which test emits it FIRST (chronologically, per worker) — that's the culprit. "My tests passed" from a spot-check is meaningless if they ran before the poisoning test. Confirm by checking whether the SAME test fails independently once the poisoner is skipped (it did: after skipping the 2 read tests on d3d12, the 2 RWTensor write tests PASSED independently on d3d12).

Related root cause: shader_resource (read-only) usage is LOAD-BEARING for array-of-Tensor read tests — you can't just add UAV to dodge the d3d12 clear. ArrayMarshall.resolve_types compares element types by full_name STRING (vectorize.py:115-119): a default-UAV tensor becomes "RWTensor<float,1>" which != slang "Tensor<float,1>" → resolution fails on ALL backends. The scalar path escapes this via tensorcommon.py:199 (adopts param access); arrays have no such adaptation. So for a read-only Tensor array param the test MUST use shader_resource, and if that crashes d3d12 the fix is to skip on d3d12 (+ file a tracking issue for the RHI robustness bug), not change the flag. Tracked: shader-slang/slangpy#1079.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785359117251-d3d12-device-removal-cascade-can-masquerade-as-ci-.md`_
