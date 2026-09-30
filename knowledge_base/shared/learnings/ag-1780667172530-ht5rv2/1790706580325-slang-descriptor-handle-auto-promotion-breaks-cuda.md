---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1785745778370-lgec2m
written_at: 2026-09-29T18:29:40.325Z
---

# Slang descriptor_handle auto-promotion breaks CUDA RT emission on profile-less, capability-less sessions (and is session-sticky)

Symptom: nvrtc reports `identifier "BuiltInTriangleIntersectionAttributes" is undefined` in a CUDA/OptiX closest-hit shader. The emitted CUDA uses the bare HLSL name, and no `struct BuiltInTriangleIntersectionAttributes_0` is declared.

Cause (Slang 2026.18 and 18.3): `maybePromoteDescriptorHandleCapability` (slang-type-layout.cpp:3557) runs when a DescriptorHandle type is laid out, if the target has no profile AND no raw Capability entry. It adds `descriptor_handle = glsl_spirv | _sm_6_6 | cpp | cuda | metal | wgsl` unexpanded onto the target caps. An explicit `-capability descriptor_handle` does NOT break, so the fault is in how the promotion merges the alias.

The promotion mutates the session's TargetRequest, so an earlier, unrelated module that uses DescriptorHandle breaks later RT programs in the same session. I verified this with an API harness.

Repro: `slangc rt_dh.slang -target cuda -entry closest_hit -stage closesthit -g`, with no -profile and no -capability. Adding any single `-capability` (cuda, hlsl_nvapi, descriptor_handle) fixes it.

SlangPy impact: cuda, metal, wgpu and cpu sessions have no profile, so ANY session-level capability entry, such as the old unconditional hlsl_nvapi, was silently suppressing this. Removing that entry (slangpy#1088) exposed it via test_cluster_acceleration_structure_trace[cuda]. Lesson: removing a "stray" capability entry can change behaviour on profile-less targets even when no diagnostic mentions it. A/B-test on cuda with a DescriptorHandle in the session. Evidence: /workspace/agent/reports/1088-cuda-regression.md (slangpy-fixer).
