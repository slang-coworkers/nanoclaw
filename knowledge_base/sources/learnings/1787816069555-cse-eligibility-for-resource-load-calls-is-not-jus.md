---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787805655972-gyqlgs
written_at: 2026-08-27T07:34:29.555Z
---

# CSE-eligibility for resource-load calls is NOT just an effect tier — DeduplicateContext has no memory-dependence analysis (correction, #12785)

CORRECTION to my prior learning "Slang has two effect tiers (ReadNone vs NoSideEffect) — only ReadNone gates call CSE". That learning correctly described the two decorations, but the fix it implied — add a third "read-only access" effect tier and wire it into the call-CSE path (`isPureFunctionalCall`/`isMovableInst` → `removeRedundancy`) — is UNSOUND as an *unconditional* dominance-preserving CSE. Verified from source on #12785 (my own Approach A recommendation was reversed by the fixer and I re-verified all of it):

- `removeRedundancy`'s `DeduplicateContext::deduplicate` (slang-ir-util.h:41-66) is a **pure structural GVN**: `Dictionary<IRInstKey,IRInst*>` keyed on op+type+operand-identity, with NO store/atomic/barrier/memory-dependence analysis. `removeRedundancyInBlock` (slang-ir-redundancy-removal.cpp:102-106) seeds each dominated child block's dedup map with the dominator's map VERBATIM. So any inst made "movable" is CSE'd across a dominating occurrence regardless of intervening writes/barriers.
- The Slang spec **"Memory Aliasing via Binding"** (docs/language-reference/basics-memory-model-special-topics.md:63-72) makes SRV `StructuredBuffer` and UAV `RWStructuredBuffer` bound to the same memory ALIASED (documented guarantee, not an impl heuristic). So `a=loadValue(i); rw[i]=42; DeviceMemoryBarrier(); b=loadValue(i)` must observe the write — structural dedup collapsing b→a is a miscompile. "Reads only immutable *through this handle*" does NOT imply value-stable in memory.
- Do NOT trust `canAddressesPotentiallyAlias`'s distinct-buffer-root non-aliasing rule to justify unconditional CSE — it's an impl assumption the spec contradicts (and slang-ir-transform-params-to-constref.cpp:203 explicitly refuses to rely on it). CUDA `__ldg` emission for StructuredBuffer loads is a CUDA-only lowering, not a language-wide no-alias guarantee.
- Three inference holes any such fix must also handle: (1) byte-address-legalize maps RWByteAddressBuffer→RWStructuredBuffer (slang-ir-byte-address-legalize.cpp:1333), so kIROp_StructuredBufferLoad at :884 can come from a MUTABLE buffer — opcode-only SRV check is wrong; must check the buffer operand is a genuine SRV. (2) specialize-function-call.cpp:1094-1101 and (3) glsl-legalize.cpp:1344-1347 both strip ReadNone/NoSideEffect, so a new effect decoration goes stale there.

The SOUND designs: (a) a real available-expressions/memory-dependence CSE pass that commons a dominated identical call only when no store/atomic/barrier/unknown-call lies between them; or (b) a bounded block-local repeatable-read-call cache cleared by every write/sync inst (smallest sound win, in-block only); or (c) a maintainer-gated assume-no-aliasing mode. All need the 3 inference fixes + an IR module version bump for the new decoration.

TRIAGE LESSON: when recommending "just separate CSE-eligibility from movability," first confirm the CSE mechanism you'd hook actually has (or gets) the memory-dependence/no-intervening-write check the transform's soundness requires. A structural GVN keyed on dominance+identity does not. Reporter intent ("no write or intervening op exists") can be sound while the naive mechanism that ignores that precondition is not.
