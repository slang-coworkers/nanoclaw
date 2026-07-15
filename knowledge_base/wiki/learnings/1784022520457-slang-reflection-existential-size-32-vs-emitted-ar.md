---
title: "slang reflection existential size (32) vs emitted ArrayStride (80) — front-end/IR phase split (#12092)"
type: learning
topic: slang-compiler
source: learnings/1784022520457-slang-reflection-existential-size-32-vs-emitted-ar.md
---

# slang reflection existential size (32) vs emitted ArrayStride (80) — front-end/IR phase split (#12092)

For a `StructuredBuffer<Interface>` whose interface has NO explicit `[anyValueSize(N)]`, the Slang
reflection API and the emitted SPIR-V disagree on the element size, and it is a genuine phase-ordering
bug, not a misread.

- REFLECTION size is computed in the FRONT-END/AST layout: `_createTypeLayout` in
  `source/slang/slang-type-layout.cpp:5982` sets `fixedExistentialValueSize = 16` and overrides it ONLY
  from the AST `findModifier<AnyValueSizeAttribute>()` (`:5983-5987`); adds a 16-byte RTTI/witness header
  (`:6020`). So with no explicit attribute → 16+16 = 32. The comment at `:5978-5980` explicitly calls the
  reservation part of the ABI contract. Exposed via `spReflectionTypeLayout_GetSize`
  (`slang-reflection-api.cpp:1401`, Uniform category count) after
  `spReflectionTypeLayout_GetElementTypeLayout` (`:1588-1590`).
- EMITTED size comes from a LATER IR pass: `inferAnyValueSizeWhereNecessary`
  (`source/slang/slang-ir-any-value-inference.cpp:419-511`, scheduled at `slang-emit.cpp:1500`, which is
  AFTER reflection and BEFORE `legalizeExistentialTypeLayout` at `:1798`). It takes the MAX
  `getNaturalSizeAndAlignment` over conformers (`:434`) and writes/updates an `IRAnyValueSizeDecoration`.
  Layout of the emitted box reads that decoration (`slang-ir-layout.cpp:292-299`, payload) + 16-byte header
  → e.g. `float4x4` conformer (64) → ArrayStride 80.
- THE GAP: reflection reads the AST attribute ONLY; it never consults the IR `IRAnyValueSizeDecoration`.
  The inferred size is never propagated back into the reflection TypeLayout.

Discriminator (settles the fix contract): an explicit `[anyValueSize(N)]` large enough makes BOTH sides
read N → they AGREE. "Explicit but too small" already diagnoses `TypeDoesNotFitAnyValueSize`
(`slang-ir-any-value-inference.cpp:443`). So divergence is SPECIFICALLY the inferred/no-attribute case,
and the user workaround is a solid explicit `[anyValueSize(N)]`.

Reproduce GPU-free: `slangc repro.slang -target spirv-asm | grep ArrayStride` shows the emitted stride;
`-reflection-json` does NOT surface existential element size — only the C++ reflection API `getSize()` does.
A root-cause fix (reflection reports the inferred size) is DESIGN-GATED: is the fixed default a deliberate
ABI value, or should reflection track the inferred size? Genuine maintainer call.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784022520457-slang-reflection-existential-size-32-vs-emitted-ar.md`_
