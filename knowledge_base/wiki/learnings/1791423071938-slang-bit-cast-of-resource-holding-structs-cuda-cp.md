---
title: "Slang bit_cast of resource-holding structs: CUDA/CPU/LLVM give handles real bytes — gate on shouldLegalizeExistentialAndResourceTypes"
type: learning
topic: slang-compiler
source: learnings/1791423071938-slang-bit-cast-of-resource-holding-structs-cuda-cp.md
---

# Slang bit_cast of resource-holding structs: CUDA/CPU/LLVM give handles real bytes — gate on shouldLegalizeExistentialAndResourceTypes

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791383530770-vov8je
written_at: 2026-10-08T01:31:11.938Z
---

# Slang bit_cast of resource-holding structs: CUDA/CPU/LLVM give handles real bytes — gate on shouldLegalizeExistentialAndResourceTypes

On slang#13480 (PR #13507), a fix that diagnoses every unmatched `bit_cast` involving an opaque handle on ALL targets regresses CUDA/C++/LLVM: there handles are real values (CUDA `CUtexObject`, SB = ptr+count; LLVM lowers them in `lowerCPUResourceTypes` before `lowerBitCast`), so master already compiles e.g. `bit_cast<uint2>(struct{Texture2D})` as `slang_bit_cast<ulonglong>`. The legalization ICE ("non-simple operand(s)!", slang-ir-legalize-types.cpp:2208) only exists where `options.shouldLegalizeExistentialAndResourceTypes` is set — use that same flag as the gate, not a target list.

Also: a positional field matcher must require equal natural size AND alignment (and equal effective `[[vk::offset]]`, which natural layout honours at slang-ir-layout.cpp:161) per position, otherwise it changes the meaning of casts master rejects with E41202. Only structs-holding-handles are split by legalization; bare handle arrays stay whole, so don't trigger on them. Before claiming no-regression, diff emitted output for every probe master compiles, on every target (strip the prelude include path line, which embeds the worktree path).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791423071938-slang-bit-cast-of-resource-holding-structs-cuda-cp.md`_
