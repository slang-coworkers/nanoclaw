---
title: "Slang varying layout: make explicit field vk::location absolute by anchoring at offset 0 (path-sum invariant)"
type: learning
topic: slang-compiler
source: learnings/1793999288631-slang-varying-layout-make-explicit-field-vk-locati.md
---

# Slang varying layout: make explicit field vk::location absolute by anchoring at offset 0 (path-sum invariant)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793989933374-lesjfp
written_at: 2026-11-06T21:08:08.631Z
---

# Slang varying layout: make explicit field vk::location absolute by anchoring at offset 0 (path-sum invariant)

Every consumer of Slang varying layouts (reflection, slang-ir-glsl-legalize.cpp createGLSLGlobalVaryingsImpl ~:2308, slang-ir-legalize-varying-params.cpp ~:3202/:3536) computes a leaf's Location by summing VarLayout offsets from the parameter down to the leaf. To make an explicit `[[vk::location(N)]]` on a struct field absolute (#14366), you do not need to touch any consumer. Anchor every layout whose subtree has a field carrying its own attribute at offset 0 in its parent. Then the field offsets are absolute, and endLayout reserves the explicit leaves before it gap-fills the implicit members and the implicit fields of anchored structs.

Traps found by /code-review on that change:
- Apply the new logic only to VaryingInput/VaryingOutput. The entry-point result also carries Uniform offsets on CPU/CUDA, and entry-point descriptor kinds must keep the old single-set path.
- A geometry-shader `triangle T v[3]` input array is per vertex, but the front end sizes it elem×3. An explicit Location on it reserves the element count only, or two consecutive explicit GS arrays falsely overlap.
- `vk::index` makes overlapping Locations legal only for fragment VaryingOutput (dual-source blending).
- Name overlap diagnostics by path (`s1.x` vs `s2.x`). The same struct used for two parameters otherwise prints the same name twice.
- `isVaryingResourceKind` is declared in slang-ir-insts.h but never defined. A static function with that name fails to compile.
- translateGlobalVaryingVar places global `in` variables after the LAST parameter's end. With gap-fill they can land on an explicit field, giving VUID-08721. The IR fix is to start them at the max end over all parameters. The front end cannot fix this alone.

A/B method that held up: compile every test file that has a `[shader("vertex|fragment|hull|domain|geometry|mesh")]` entry point and no vk::location with the base and the new slangc, to spirv-asm/glsl/metal/wgsl plus -reflection-json. Run each binary in its own output dir with the same file names, so stderr paths compare equal.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793999288631-slang-varying-layout-make-explicit-field-vk-locati.md`_
