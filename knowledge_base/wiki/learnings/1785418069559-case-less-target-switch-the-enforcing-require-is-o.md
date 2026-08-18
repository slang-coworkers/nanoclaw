---
title: "Case-less __target_switch: the enforcing [require] is on the resource TYPE, not the method"
type: learning
topic: ci-tooling
source: learnings/1785418069559-case-less-target-switch-the-enforcing-require-is-o.md
---

# Case-less __target_switch: the enforcing [require] is on the resource TYPE, not the method

# Where a `Buffer<T>`-style capability diagnostic actually fires

Following up on the #12274 root-cause learning (case-less `__target_switch` in `*.meta.slang` emits an empty body, not a diagnostic). When you fix it via Approach A (diagnose), the **enforcement layer matters** and it's counterintuitive:

**The method-level `[require(...)]` on the intrinsic (e.g. `_Texture.Load`) does NOT enforce when that method's body is a case-less `__target_switch`.** A switch with no case for the active target infers an *empty* function body → an empty inferred capability set → it trivially passes the target-compatibility check. So the `[require(glsl_hlsl_metal_spirv, ...)]` sitting right on `Load` is inert for the very target it's meant to exclude.

**The effective gate is the TYPE-level `[require(...)]` on the resource's shape/struct.** For `Buffer<T>` = `_Texture<T, __ShapeBuffer, ...>`, that's `[require(...)]` on `struct __ShapeBuffer` (hlsl.meta.slang:572). Verified empirically: WGSL was already excluded from that list and fires a clean `error[E36107]: unavailable features in entry point` naming `__ShapeBuffer`; cuda/cpp were in the list → admitted → fell through to the empty body.

**Fix = drop the incapable target from the TYPE's `[require]`**, mirroring the WGSL precedent PR #6585 ("Require that target is not WGSL for Buffer and RWBuffer"). One token: `cpp_cuda_glsl_hlsl_metal_spirv` → `cpp_glsl_hlsl_metal_spirv` (aliases pre-exist in `slang-capabilities.capdef`). `-target ptx` routes through the `cuda` capability atom, so dropping `cuda` covers ptx too. Labeled `pr: non-breaking` (matches #6585).

**Scope gotchas:**
- Do NOT drop a target that has a REAL prelude type. `cpp` hits the same empty-body path but `prelude/slang-cpp-types.h` has a working `struct Buffer<T>` — its gap is a missing `case cpp:` (implement-territory), not incapability. Excluding it would remove intended support.
- `StructuredBuffer`/`RWStructuredBuffer` are NOT `__ShapeBuffer`-backed (real pointers) — the type-level edit doesn't touch them. Verify.
- **Cascading test breakage:** removing a target from a resource type's `[require]` breaks unrelated `tests/diagnostics/` tests that used that resource as an *incidental* entry-point param on that target (e.g. `RWBuffer<float> output` in a test that's really about the main-rename warning). Swap the incidental param to a supported real-pointer buffer (`RWStructuredBuffer<float>`) to preserve coverage — not masking, since the param isn't what the test asserts. Sweep `tests/diagnostics/` + broad dirs and baseline pre-existing failures against a clean master clone.

Shipped: shader-slang/slang#12274 → draft PR #12289.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785418069559-case-less-target-switch-the-enforcing-require-is-o.md`_
