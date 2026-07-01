---
title: "When planning a new SPIR-V opcode, check terminator-ness — not just value-producing-ness"
type: learning
topic: slang-compiler
source: learnings/1781039584587-when-planning-a-new-spir-v-opcode-check-terminator.md
---

# When planning a new SPIR-V opcode, check terminator-ness — not just value-producing-ness

When planning to add a Slang IR opcode + SPIR-V emit for a new SPIR-V instruction (e.g. #11528 `OpAbortKHR` for `SPV_KHR_abort`), do NOT classify it only as "value-producing vs void like printf". **Also check whether the SPIR-V op is a block TERMINATOR** ("must be the last instruction in a block") — this materially changes the IR modeling.

**Why:** `OpAbortKHR` is class Control-Flow, no-result, AND a block terminator (ceases the invocation, like OpKill/OpTerminateInvocation/OpReturn). A careful multi-round triage memo modeled it purely printf-parallel (printf is a NON-terminator) and missed this entirely. Modeling a terminator op like printf yields invalid SPIR-V (op-then-OpBranch in the same block).

**How to apply:**
- Slang's precedent for "SPIR-V terminator modeled as a NON-terminator IR inst" is `discard`/`OpKill` (both `Printf` and `discard` sit OUTSIDE the `TerminatorInst` group in slang-ir-insts.lua ~1340-1432). The terminator-ness is handled at emit time: (1) after emitting the terminator, STOP emitting the rest of the block — `slang-emit-spirv.cpp:4274-4277`; (2) a dedicated legalize pass removes unreachable code after it — `slang-ir-spirv-legalize.cpp:3020` `removeUnreachableCodeAfterDiscardForOpKill`. A new terminator-op needs both, which curated file maps based on the printf precedent omit. (Reinforces the grep-not-list rule: `grep -rn kIROp_Discard source/` for terminator touchpoints, not just `kIROp_Printf`.)
- Two more corrections that recur: (a) SPIR-V capability atoms in `slang-capabilities.capdef` are HAND-MAINTAINED one-liners (16 `SPV_KHR_*` defs), NOT auto-generated from spirv.core.grammar.json (the grammar generators only build opcode name↔number tables) — a new `SPV_KHR_*` feature needs a manual `def SPV_KHR_x : _spirv_1_0;` + `alias` line. (b) Slang compiles against the `external/spirv-headers` SUBMODULE (uninitialized in fresh checkouts) — NOT the separate vendored `external/spirv/spirv.h`, which lags and lacks recent enums. Init the submodule before claiming "enum already vendored".
- For abort specifically: the "8-byte length prefix / 8-byte aligned" framing is the HOST-side wire format in `pMessageData` (driver-produced for `VK_KHR_device_fault` retrieval), NOT the OpTypeStruct member packing (which uses natural alignment + explicit `OpMemberDecorate Offset` + `UTFEncodedKHR` + `ArrayStride 1` string members).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781039584587-when-planning-a-new-spir-v-opcode-check-terminator.md`_
