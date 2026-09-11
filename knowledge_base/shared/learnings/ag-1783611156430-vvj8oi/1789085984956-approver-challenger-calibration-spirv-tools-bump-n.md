---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789083223240-3ij5m1
written_at: 2026-09-11T00:19:44.956Z
---

# [approver/challenger-calibration] SPIRV-Tools bump: NonSemantic ext-inst disassembly is per-set explicit, not generic

## Symptom
On a SPIRV-{Headers,Tools} version-bump PR (shader-slang/slang#12996, VulkanSDK
Sep 2026), the primary bot review flagged a 🟡 gap: a sibling test
(`tests/hlsl-intrinsic/debug-break-spirv-direct.slang`) that matches a
`NonSemantic.DebugBreak` `OpExtInst` by numeric opcode `1` was "not updated for
the same disassembler naming change," predicting a FileCheck failure — by
analogy to the two `NonSemantic.DebugPrintf` tests the PR *did* update from
numeric `1` to symbolic `DebugPrintf`.

## Root cause (why the gap was a false alarm)
SPIRV-Tools' disassembler name-lookup is **per-set explicit, not generic**. In
`source/ext_inst.cpp` (`spvExtInstImportTypeGet`), each symbolically-disassembled
extended-instruction set has its own `strcmp`/`strncmp` case (e.g.
`"NonSemantic.DebugPrintf"` → `SPV_EXT_INST_TYPE_NONSEMANTIC_DEBUGPRINTF`). Any
`NonSemantic.*` name with no explicit case falls through to
`SPV_EXT_INST_TYPE_NONSEMANTIC_UNKNOWN`, which `disassemble.cpp` prints
**numerically**. `NonSemantic.DebugBreak` has no case and no enum member in
`include/spirv-tools/libspirv.h`, so its opcode `1` still disassembles as `1` —
the existing test is correct and its non-update is right. A
`extinst.nonsemantic.debugbreak.grammar.json` existing in SPIRV-Headers does NOT
imply symbolic disassembly — it must also be wired into ext_inst.cpp; here it is
not, and that grammar was byte-identical in the old and new headers anyway.

## How to catch it
When a bot flags "sibling ext-inst test not updated" on a SPIRV-Tools bump, do
NOT reason by analogy. Check whether the bumped SPIRV-Tools registers *that
specific set name* in `source/ext_inst.cpp`'s name-lookup (and has a matching
`SPV_EXT_INST_TYPE_*` member in `include/spirv-tools/libspirv.h`). Registered ⇒
symbolic ⇒ test must update; unregistered ⇒ `NONSEMANTIC_UNKNOWN` ⇒ numeric ⇒
correct. Slang routes SPIR-V disassembly straight through
`spvtools::SpirvTools::Disassemble` (no separate slang name table), so the
spirv-tools behavior is authoritative. Corroborate with combined CI green on the
head (these SIMPLE filecheck-spirv tests run on CPU) and with the grammar being
unchanged old→new. Other-org repos (KhronosGroup/SPIRV-{Headers,Tools}) 401
through the proxy/`gh` — read them via `raw.githubusercontent.com` at the pinned
commit.

## Fix
Cleared the gap as a false alarm (no reachable trigger) → WOULD_APPROVE.
Transferable rule: ext-inst symbolic naming is opt-in per set in spirv-tools;
only update tests for sets that spirv-tools actually registers.
