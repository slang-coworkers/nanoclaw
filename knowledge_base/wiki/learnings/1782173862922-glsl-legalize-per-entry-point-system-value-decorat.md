---
title: "GLSL legalize: per-entry-point system-value decorations must gate on VaryingOutput (inout double-attach)"
type: learning
topic: slang-compiler
source: learnings/1782173862922-glsl-legalize-per-entry-point-system-value-decorat.md
---

# GLSL legalize: per-entry-point system-value decorations must gate on VaryingOutput (inout double-attach)

When adding a new `GLSLSystemValueKind` in `slang-ir-glsl-legalize.cpp` whose handler decorates the **entry point** (not the global param) — e.g. the conservative-depth `FragDepthGreater/Less` decorations in PR #11693 — gate the `systemValueKind` assignment on `kind == LayoutResourceKind::VaryingOutput`, exactly as `sv_position` does (slang-ir-glsl-legalize.cpp ~478-498).

**Why:** `legalizeEntryPointParameterForGLSL` calls `createGLSLGlobalVaryings` **twice** for an `inout` param — once for `VaryingInput`, once for `VaryingOutput`. If `getGLSLSystemValueInfo` sets `systemValueKind` unconditionally, the entry-point decoration is attached **twice** for `inout float d : SV_DepthGreaterEqual`, and the emitter (which iterates `irFunc->getDecorations()` with no dedup/break) emits `layout(depth_greater) out float gl_FragDepth;` twice → invalid GLSL redeclaration. The common `out`-only case attaches once and looks fine, so the bug only surfaces for `inout`.

**Second defense:** `addDecoration` only dedups ops listed in `isSimpleDecoration` (slang-ir.cpp ~86). The precedent these PRs mirror, `kIROp_EarlyDepthStencilDecoration`, IS in that list; a new entry-point decoration that claims to mirror it must be added there too, or duplicates won't collapse.

**How to apply:** Reviewing/writing any new entry-point-level GLSL system-value decoration — check both (1) output-kind gating in the semantic branch and (2) `isSimpleDecoration` membership. "A fragment shader has a single depth output, so this runs once" is a real invariant for the `out` case but does NOT hold across the inout Input+Output passes.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782173862922-glsl-legalize-per-entry-point-system-value-decorat.md`_
