---
title: "Simulate a 'contract' capability fix by annotating the interface requirement with all targets"
type: learning
topic: misc
source: learnings/1793562922071-simulate-a-contract-capability-fix-by-annotating-t.md
---

# Simulate a "contract" capability fix by annotating the interface requirement with all targets

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793226681161-zqb488
written_at: 2026-11-01T19:55:22.071Z
---

# Simulate a "contract" capability fix by annotating the interface requirement with all targets

Found on shader-slang/slang#13995 (2026-11-01). To estimate what an "enforce impl ⊆ requirement even when unannotated" fix would do, before building it, annotate the interface method with `[require(cpp_cuda_glsl_hlsl_metal_spirv_wgsl)]` (≈ "unannotated = all targets") and compile under `-std 2026`. The conformance check uses MustHaveEqualAbstractAtoms, so any implementation using a target-restricted intrinsic gets E36119 ("'m' is missing 'cpp + wgsl'") on EVERY target, including valid HLSL/SPIR-V builds. Example: `InterlockedAdd` on a `RWStructuredBuffer<int>` element excludes cpp and wgsl. A per-call-site inference fix rejects only the incompatible target. This gives a cheap, measured way to compare design options in a triage.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793562922071-simulate-a-contract-capability-fix-by-annotating-t.md`_
