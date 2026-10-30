---
type: chain
title: "slang#14077 — DXR pipeline creation crashes (NVIDIA driver) for native TraceRay in a `[noinline]` helper"
description: Human-filed by kaizhangNV (MEMBER, self-assigned) 2026-10-30 00:30:18Z, found during portable-RT work. DXIL compiles and validates; CreateStateObject AVs in nvwgf2umx.dll only with [noinline]. Reporter says root ownership is unknown (driver symptom, not a proven Slang defect). R6 crash-exempt (crash word + fences). Triaged 10-30 00:52Z: Slang DXIL matches DXC-only HLSL, so the driver is the likely owner; comment 6512163899 posted. Parked on the reporter's DXC-only repro run; triager re-check t-c511aa 11-03 00:30Z; no fixer.
tags: [dxil, hlsl, ray-tracing, noinline, d3d12, nvidia-driver, r6]
resource: /workspace/agent/reports/triage/triage-14077.md
---

# slang#14077 — `[noinline]` TraceRay helper crashes DXR pipeline creation on NVIDIA

**Ask.** A closesthit entry calls a `[noinline]` helper that runs a native `TraceRay` with a second payload type.
Slang 2026.19 compiles the three entry points to DXIL `sm_6_6` and DXC 1.9.2602.17 validates them. A raw
D3D12 host (Agility SDK 619, no Slang linkage) gets `0xC0000005` inside `ID3D12Device5::CreateStateObject`,
fault in `nvwgf2umx.dll` 32.0.15.8216, RTX 3500 Ada Laptop. Removing only `[noinline]` gives `S_OK`.
The same test passes on Vulkan and OptiX. The reporter states this is a driver/state-object symptom, not a
demonstrated Slang defect. Distinct from [#14070](14070-dxil-noinline-ignorehit-validation.md) (DXC rejects
IgnoreHit in a noinline helper at compile time).

**Routing (10-30 ~00:3xZ).** Live check: open, 0 comments, no labels, assignee kaizhangNV, MEMBER.
The memory grep for 14077 had no hit; `gh search` for `noinline TraceRay` found nothing; the only session on the
thread was my webhook session. R6: the body has "crashes" and ≥2 code fences, so `is_crash_with_repro` exempts
it (same as sibling [#14067](14067-ir-validate-throw-terminator.md), which posted). Same-reporter siblings:
[14066](14066-result-void-error-extraction.md), [14070](14070-dxil-noinline-ignorehit-validation.md),
[14075](14075-generic-assoc-equality-conformance.md).
Dispatched to slang-triager on `gh-issue-shader-slang/slang-14077`. Limits I stated: this container has no D3D12,
so the triager must not claim to reproduce the CreateStateObject crash; it compares the DXIL for the inline
and noinline variants (and against hand-written HLSL through DXC alone) for a Slang-side difference.
My hypothesis, not checked: the helper's linkage/export in the `lib_6_6` library.
- 10-30 00:35Z, triager ack: diffing inline vs `[noinline]` DXIL on ToT; DXC-only HLSL and the Vulkan control come next.

**Triage (slang-triager, 10-30 00:52Z, ToT 1f0b33b86, DXC 21d28f72; the triager's findings, I verified only that the comment exists).**
bug, owner likely the NVIDIA driver / medium / P3 for Slang / HLSL-DXIL emit. Not a regression, not a duplicate.
- Inline vs noinline: RG and Miss are byte-identical. CH adds only `define internal fastcc` helper `noinline nounwind`. Payload types, function props and `dx.entryPoints` are the same.
- **My linkage hypothesis is refuted:** the helper is internal and not in `dx.entryPoints`. It is in the RDAT FunctionTable as ShaderKind=Library, but DXC alone does the same.
- DXC-only HLSL with Slang's flags gives an identical helper. The remaining diffs (`-enable-16bit-types`, a float4 payload store, ordering, `_0` suffixes) also exist in the working inline build.
- Vulkan control on the L40S passes for both variants (ToT and 2026.12). Catch: the shader as written puts t0 and u0 both on Vulkan binding 0 (E39029).
- Related: DXC#9012 (same nvwgf2umx CreateStateObject symptom), DXC#7152 (noinline in libraries is "somewhat experimental").
- Options: **A (rec)** no Slang change; the reporter runs the DXC-only lib, then reports to NVIDIA. B force-inline TraceRay-reaching callees on DXIL (generalise #11660); the reporter rejects it. C a docs note.

**Parked 10-30 00:52Z** on the reporter. GitHub comment [6512163899](https://github.com/shader-slang/slang/issues/14077#issuecomment-6512163899) (5-bullet, live-checked 00:5xZ). No label and no Type. The triager's one-shot **t-c511aa** runs 2026-11-03 00:30Z; my `ncl tasks get` cannot see it.
