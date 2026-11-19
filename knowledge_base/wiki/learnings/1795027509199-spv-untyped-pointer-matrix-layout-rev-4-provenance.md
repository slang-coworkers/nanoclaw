---
title: "SPV untyped-pointer matrix layout: rev-4 provenance rule makes Slang's heap-CB emission spec-correct (#14541 = NVIDIA driver bug)"
type: learning
topic: slang-compiler
source: learnings/1795027509199-spv-untyped-pointer-matrix-layout-rev-4-provenance.md
---

# SPV untyped-pointer matrix layout: rev-4 provenance rule makes Slang's heap-CB emission spec-correct (#14541 = NVIDIA driver bug)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795026320645-qqk8bg
written_at: 2026-11-18T18:45:09.199Z
---

# SPV untyped-pointer matrix layout: rev-4 provenance rule makes Slang's heap-CB emission spec-correct (#14541 = NVIDIA driver bug)

**Rule:** Matrix loads through SPIR-V *untyped* pointers get their layout from struct-member decorations via provenance — SPV_KHR_untyped_pointers rev 4 (2026-06-20, "Clarify matrix access rules") §2.16.2 requires any untyped pointer accessed as a matrix/array-of-matrices/row to be the result of an access chain whose **Base Type is a structure** (or a pure access-chain sequence from one), used only as OpLoad/OpStore pointer; the §2 "as-if OpTypePointer" clause then makes the load inherit that member's RowMajor/MatrixStride. Any other reading makes the rev-4 rule vacuous (structs are SPIR-V's only layout-carrying construct).

**Why it matters (slang#14541):** Slang's heap-ConstantBuffer emission (`OpBufferPointerEXT %_ptr_Uniform` → `OpUntypedAccessChainKHR` with Block-struct Base Type, member RowMajor+MatrixStride 16 → `OpLoad %mat4v4float`, post-#12256) is exactly this sanctioned form, so the L40S transposed-reads + VK_ERROR_DEVICE_LOST (driver 595.91.07; Mesa Xe2 correct; v2026.11 typed-path correct on the same driver) is an **NVIDIA driver bug, not wrong codegen** — posted analysis: issuecomment-6988124513 (codex-critiqued, verdict upheld). Corollaries: at stride 16 a 4×4 row/col-major reading covers the same 64 bytes, so a transpose can never be an addressing/stride fault; spirv-val passing is compatible with driver misbehavior because it certifies the producer (grammar/decorations), never execution semantics. Also: release slangc needs `LD_LIBRARY_PATH=build/Debug/lib` for `-target spirv-asm` / SLANG_RUN_SPIRV_VALIDATION (the non-dwarf `libslang-glslang-2026.13.1.so` lives there, Release only has the .dwarf variant).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795027509199-spv-untyped-pointer-matrix-layout-rev-4-provenance.md`_
