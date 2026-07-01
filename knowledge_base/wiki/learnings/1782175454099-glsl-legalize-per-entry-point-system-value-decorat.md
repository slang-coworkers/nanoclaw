---
title: "GLSL legalize: per-entry-point system-value decorations must gate on VaryingOutput (inout double-attach)"
type: learning
topic: slang-compiler
source: learnings/1782175454099-glsl-legalize-per-entry-point-system-value-decorat.md
---

# GLSL legalize: per-entry-point system-value decorations must gate on VaryingOutput (inout double-attach)

When adding a new `GLSLSystemValueKind` in `slang-ir-glsl-legalize.cpp` whose handler decorates the **entry point** (not the global param) — e.g. the conservative-depth `FragDepthGreater/Less` decorations in PR #11693 — gate the `systemValueKind` assignment on `kind == LayoutResourceKind::VaryingOutput`, exactly as `sv_position` does (slang-ir-glsl-legalize.cpp ~478-498), AND add the new ops to `isSimpleDecoration` (slang-ir.cpp ~86) so `addDecoration` deduplicates, matching the `kIROp_EarlyDepthStencilDecoration` precedent.

**The mechanical hazard (abstract):** `legalizeEntryPointParameterForGLSL` calls `createGLSLGlobalVaryings` **twice** for an `inout` param — once `VaryingInput`, once `VaryingOutput`. An unconditional `systemValueKind` assignment would attach the entry-point decoration twice; the emitter (iterates `irFunc->getDecorations()`, no dedup/break) would then emit `layout(depth_greater) out float gl_FragDepth;` twice = invalid GLSL.

**CORRECTION (verified against shader-slang/slang, 2026-06-23) — for depth specifically this is UNREACHABLE:** `sv_depth`/`sv_depthgreaterequal`/`sv_depthlessequal` are defined output-only in `core.meta.slang` (~4945-4961): each declares `set : float` with NO getter. Using one as input (the input leg of an `inout`) is rejected by the semantic checker with **E30702 `SystemValueSemanticInvalidDirection`** ("cannot be used as input in 'pixel' shader stage") — `slang-check-shader.cpp:254-265` diagnoses when no accessor exists for the requested direction, before IR/GLSL legalization runs. So the `inout` double-attach cannot occur for depth; an `inout depth : SV_DepthGreaterEqual` regression test does not compile. The `VaryingOutput` gate + `isSimpleDecoration` dedup are correct **defense-in-depth**, not a fix for a reachable bug.

**How to apply:** For a NEW entry-point-level GLSL system-value decoration, still do both (gate on output kind + `isSimpleDecoration`) as cheap defense-in-depth — but first check the semantic's accessor definition in `core.meta.slang`: if it is setter-only (output-only), the front-end E30702 check already forecloses the input/inout path, so don't claim a reachable double-emit bug or ship an `inout` regression test (it won't compile). The reachability question turns on whether the semantic has a getter.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782175454099-glsl-legalize-per-entry-point-system-value-decorat.md`_
