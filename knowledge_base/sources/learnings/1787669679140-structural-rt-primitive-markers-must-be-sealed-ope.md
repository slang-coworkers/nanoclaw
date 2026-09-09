---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787668564792-l6ti1k
written_at: 2026-08-25T14:54:39.140Z
---

# Structural RT primitive markers must be sealed — open marker + open Custom bucket = target-lowering SIGSEGV

**Context:** shader-slang/slang#12743 (triage). The structural ray-tracing API on draft PR #12691 has a closed intended primitive set (TrianglePrimitive, CurvePrimitive, BoundingBoxPrimitive<T>), but the marker interface `rt::IIntersectionPrimitive` is plain `public` and unsealed.

**The bug pattern:** `getHitAttributesKind()` (slang-structural-ray-tracing.cpp:597-609) recognizes only Triangle/Curve *by name* (decl-identity pointer equality against 2 cached types) and routes **every other conformer into an open `Custom` catch-all arm**. The RT hit-context checker (slang-check-structural-ray-tracing.cpp:606-608) accepts any kind != None. So a user `struct Foo : rt::IIntersectionPrimitive` passes semantic checking as `Custom`, then target lowering treats it as procedural/BoundingBox geometry that must carry an intersection shader it can never have → HLSL synthesizes no intersection entry point while the trace assumes one; Metal hits `SLANG_UNEXPECTED` (slang-emit-metal.cpp:1607) or a null deref → SIGSEGV/139.

**Two general lessons:**
1. **An "open catch-all enum arm" (`Custom`/`Default`/`Other`) for a conceptually closed set is a crash trap** when the arm's consumers assume more structure than a bare fallback carries. Prefer registering the *sanctioned* members explicitly (here: register `ICustomIntersectionPrimitive`/`BoundingBoxPrimitive` in `registerTrustedModule`) so the classifier can tell sanctioned-custom from unsupported, rather than letting anything fall into the permissive arm.
2. **A compiler-owned marker interface that users must not implement directly should be `[sealed]`.** Slang precedent: `__BuiltinType` etc. are `[sealed]`+`[builtin]`; cross-module conformance to a `[sealed]` type is rejected with E30830 (enforced in `_validateCrossModuleInheritance`, slang-check-decl.cpp:11622/11665). Because builtin conformers live in the *same* module as the marker, `[sealed]` rejects only user (other-module) conformance while builtins still conform. The other model is the COM-interface rejection in `checkConformance` (slang-check-decl.cpp:11215-11238 → `StructCannotImplementComInterface`). Diagnostics now live in `source/slang/slang-diagnostics.lua`, not slang-diagnostic-defs.h.

**Fix floor (matches recalled #12273 RT crash-class lesson):** reject at the *front end* with a real diagnostic before IR/target lowering — never a silent emit-side guard that papers over the malformed shape.

**Triage/routing note:** the feature exists ONLY on the author's draft PR branch, not master — so `reproduced` label does NOT apply (not a top-of-tree repro) and the fix must land on that PR, not a standalone master PR. Reporter = the PR author (core team), so resolution/advisory is an operator call (see #12728 pattern).
