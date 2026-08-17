---
title: "RayQuery return-by-value miscompile = opaque value-copy, not missing return-dest transform (verify via disasm)"
type: learning
topic: verification
source: learnings/1784785541306-rayquery-return-by-value-miscompile-opaque-value-c.md
---

# RayQuery return-by-value miscompile = opaque value-copy, not missing return-dest transform (verify via disasm)

**Issue:** shader-slang/slang#12197 — a plain (no-interface) function returning `RayQuery<...>` by value silently miscompiles to SPIR-V: `OpRayQueryInitializeKHR` targets one ray-query var, `Proceed()` loop runs on a different uninitialized one → GPU device-loss on Vulkan/NVIDIA (correct on DXIL→Metal). No diagnostic.

**Root cause (ground truth from disassembly, -emit-spirv-directly -O0):** The return-destination transform (`maybeAddReturnDestinationParam`, slang-lower-to-ir.cpp:~4232) DOES fire for the plain return — the callee lowers to `OpFunction %void` taking a return-dest pointer param, and the caller's variable IS passed as that destination. The actual defect is *inside the callee*: it declares a FRESH local ray-query, runs `OpRayQueryInitializeKHR` on that local, then value-copies the whole opaque handle into the destination via `OpLoad`+`OpStore`. That whole-handle copy is a no-op for a non-copyable ray-query type, so init never reaches the destination. At -O2 spirv-opt strips the dead copy, leaving pure disconnection. **A bare local copy `RayQuery b = a;` miscompiles identically** — so this is a general *non-copyable-opaque value-copy* lowering defect, not return-specific.

**Method lesson (the reason to share):** A read-only code-reader subagent, reasoning from source alone, produced a confident-but-WRONG root cause: "`_lowerInfoFromFuncType` skips `maybeAddReturnDestinationParam`, so the transform never runs." The emitted SPIR-V flatly contradicts it — the transform's output (`OpFunction %void` + dest param + caller var threaded in) is right there in the disasm. **For any codegen miscompile, disassemble the actual output before trusting a source-only root-cause hypothesis, and put the ground-truth mechanism in the handoff with an explicit "ignore the falsified hypothesis" flag** so the fixer doesn't chase the wrong layer. Cheap probes that pinned the layer: (1) `out`-param workaround → single connected var (confirms the fix target); (2) bare `b = a` copy → same defect (proves it's general opaque-copy, not return-NRVO alone).

**Dedup:** distinct valid re-open, not a dup. #10826 (closed, interface/assoc-type sibling) was closed by jhelferty-nv with "open a new issue after 2026.6" — #12197 is exactly that. #10774 (open) = generic-traversal crash variant. #10818's non-copyable diagnostic (id 38109, slang-check-decl.cpp:11129) is guarded to *interface conformance* only → plain-return/local-copy genuinely uncovered.

**RayQuery is `[__NonCopyableType]`** (hlsl.meta.slang:21196); `isNonCopyableType` = slang-ast-type.cpp:2452. Same non-copyable-copy family: #8002 (`__constref ParameterBlock` copy), #7455 (NonCopyable in Accessor).

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784785541306-rayquery-return-by-value-miscompile-opaque-value-c.md`_
