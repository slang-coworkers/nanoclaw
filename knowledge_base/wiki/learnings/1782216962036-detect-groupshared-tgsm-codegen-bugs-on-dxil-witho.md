---
title: "Detect groupshared/TGSM codegen bugs on DXIL without a GPU (addrspace(3) vs alloca)"
type: learning
topic: misc
source: learnings/1782216962036-detect-groupshared-tgsm-codegen-bugs-on-dxil-witho.md
---

# Detect groupshared/TGSM codegen bugs on DXIL without a GPU (addrspace(3) vs alloca)

When triaging a "wrong groupshared results on DXIL" bug with no GPU, you can reproduce and prove the defect *statically* from the emitted DXIL — no runtime needed:

- `slangc -target dxil-asm -profile sm_6_0 -entry <e> -stage compute <file>` emits DXIL assembly (DXC downstream is available in-container; exit 0).
- Correct thread-group-shared memory shows as **`addrspace(3)`** globals (TGSM) with `@dx.op.barrier` synchronizing them. **Broken** = a per-thread `alloca [N x ...]` and **zero `addrspace(3)`** — barriers then synchronize nothing. "No `addrspace(3)` exists" is dispositive of wrong codegen regardless of runtime (per-thread storage can't be shared). Justifies the `reproduced` label as a codegen-level repro; state the no-GPU caveat.
- ALWAYS include a positive control (a plain `groupshared` global used directly → expect `addrspace(3)>0`) to prove the tool renders TGSM when correct, so the absence in the repro is meaningful, not a tooling artifact.
- SPIRV counterpart: `-target spirv-asm`, look for `OpVariable … Workgroup` + `OpAccessChain … Workgroup` (correct shared storage). DXIL-wrong/SPIRV-correct is explained by: groupshared-ness is carried only by a `GroupSharedRate` qualifier (slang-lower-to-ir.cpp), and the `specializeAddressSpace` recovery pass that resolves a groupshared *parameter* to its backing global runs for SPIRV/GLSL/Metal/WGSL but NOT HLSL/DXIL (slang-emit.cpp ~2278-2290); the inliner only re-propagates address space for `IRPtrTypeBase` args (slang-ir-inline.cpp ~750-755), so a rate-qualified groupshared ARRAY param is never resolved to the global on DXIL.

FINDING (#10641): the real discriminator for that bug is the **groupshared array PARAMETER**, not [ForceInline]/generics/cross-module — ANY function taking a `groupshared T scratch[N]` param loses TGSM on DXIL; only direct use of a groupshared global works.

STALE-BINARY TRAP: the prebuilt build/Debug/bin/slangc can be many commits behind your reset checkout, and `git checkout` does NOT bump file mtimes, so ninja silently serves the stale binary (no recompile). To test at exact HEAD you must force a rebuild (touch sources / clean) — the version string in slang-tag-version.h can also be cosmetically stuck, so verify via `git describe` + confirm behavior changed.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782216962036-detect-groupshared-tgsm-codegen-bugs-on-dxil-witho.md`_
