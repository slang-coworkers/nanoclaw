---
title: "Metal pointers: address space never reaches `constant`; Access.Read vs Immutable soundness; CDataLayout gate"
type: learning
topic: slang-compiler
source: learnings/1793557667102-metal-pointers-address-space-never-reaches-constan.md
---

# Metal pointers: address space never reaches `constant`; Access.Read vs Immutable soundness; CDataLayout gate

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793555231782-srmg7u
written_at: 2026-11-01T18:27:47.102Z
---

# Metal pointers: address space never reaches `constant`; Access.Read vs Immutable soundness; CDataLayout gate

From triaging shader-slang/slang#14141 on 2026-11-01 at master 6815ed82d.

- **Every user pointer comes out as `device*` on Metal.** This applies to `T*`, `ImmutablePtr<T>` and `Ptr<T, Access.Read>`. The reason is that `MetalAddressSpaceAssigner` (`slang-ir-metal-legalize.cpp:172-186`) keeps `UserPointer` as it is.
- **The emitter ignores the pointer's access operand.** For a plain `kIROp_PtrType`, `slang-emit-metal.cpp:1431-1471` never reads it. It emits `const` only for BorrowIn, and for RefParam with Read access. DeepWiki claims that `Access.Read` produces `const device`. That is wrong.
- **The user-facing `AddressSpace` enum has only Device, GroupShared and VaryingInput** (`core.meta.slang:1446`). Writing `AddressSpace.Uniform` or `AddressSpace.Constant` gives E30027, which is the generic "member not found" error.
- **A `uniform Ptr<..., AddressSpace.VaryingInput>` crashes the Metal emitter** with "Unknown addressspace encountered". On SPIR-V the same code produces invalid output. Filed as #14142.
- **Soundness of mapping to Metal `constant`:**
  - The doc for `Access.Read` (`core.meta.slang:1474-1480`) explicitly allows writes through other pointers, so mapping it to `constant` is unsound.
  - `Access.Immutable` is documented as "UB if changed", which matches what `constant` assumes, so that mapping is sound.
  - Even so, retyping every existing `ImmutablePtr` to `constant` changes codegen for current users. That includes large per-thread-indexed arrays, which are the CUDA `__ldg` idiom, and for which Apple's guidance is to use `device`.
- **Vector packing depends on the address space.** `usesPackedVectorStorage` (`slang-ir-lower-buffer-element-type.cpp:3141`) packs only StorageBuffer and UserPointer. If a pointer is retyped to `Uniform` before buffer lowering, `packed_float3` (12 bytes) silently becomes `float3` (16 bytes).
- **`CDataLayout` is gated off Metal.** It is declared with `[require(spirv)] [require(llvm)] [require(cpp)] [require(cuda)]` (`hlsl.meta.slang:66-71`), so it gives E36107 on Metal. Draft PR #13425 adds natural-layout plumbing for `ConstantBuffer<T, ScalarDataLayout>` only and leaves the `CDataLayout` gate in place. Extending it to `CDataLayout` takes:
  - `[require(metal)]` on `CDataLayout`;
  - two layout-type cases;
  - a `shouldUseCLayout` guard for Metal.
- **Two tooling traps:**
  - Codex sessions started via `mcp__codex__codex` sometimes answer the first prompt with an unrelated wiki-recall digest. Reply on the same thread and ask for the structured output.
  - Codex OUTPUT_REVIEW catches over-claims such as "nothing in the core module uses X". Grep for `AddressSpace.X` itself, not only for `X`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793557667102-metal-pointers-address-space-never-reaches-constan.md`_
