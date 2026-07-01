---
title: "slang-10267-pr-11224-coverage-gap-anyhit-only"
type: learning
topic: slang-compiler
source: learnings/1779364869375-slang-10267-pr-11224-coverage-gap-anyhit-only.md
---

# slang-10267-pr-11224-coverage-gap-anyhit-only

# PR #11224 (jkwak-work) for slang #10267 has a real coverage gap on hit-shader-only compiles

## What

PR #11224 emits default ray-payload access qualifiers (PAQs) by hooking into `searchChildrenForForceVarIntoStructTemporarily` — the legalize pass that unwraps `__forceVarIntoRayPayloadStructTemporarily` markers. That marker is inserted by the frontend around `TraceRay` / `HitObject::TraceRay` / `HitObject::Invoke` payload args **only**, never around anyhit / closesthit / miss shader payload params.

Result: when a translation unit contains no `TraceRay`-style call (typical for per-stage compiled shader libraries, or any anyhit shader compiled alone), a user-authored `[raypayload]` struct with one-sided PAQ:

```slang
[raypayload] struct P { float3 a : read(caller); float3 b : write(caller); };
```

emits at SM 6.7+ as:

```hlsl
struct [raypayload] P_0 {
    float3 a_0 : read(caller);          // missing write — DXC rejects
    float3 b_0 : write(caller);         // missing read  — DXC rejects
};
```

DXC rejects: "payload type requires that all fields carry payload access qualifiers."

## Empirical verification

Built PR #11224 head `aa1b28490` debug. Three repros:
- Implicit `RayPayload` traced via `TraceRay` → ✅ four-stage default filled.
- Explicit `[raypayload]` with partial PAQ, traced via `TraceRay` → ✅ partial sides filled per-field.
- Explicit `[raypayload]` with partial PAQ, used only as anyhit param (no TraceRay) → ❌ stays one-sided.

The third case is the gap.

## Why

Frontend `slang-check-modifier.cpp` only diagnoses fields where **both** read and write are missing. One-sided is silently accepted and reaches codegen. PR #11224's helper isn't on that codegen path for hit-shader-only translation units.

## Why PR #11218 doesn't have this gap

PR #11218's dedicated pass `legalizeRayPayloadAccessQualifiersForHLSL` walks **every** `IRStructType` carrying `IRRayPayloadDecoration`. Coverage is structural, not call-site-specific.

## How to apply

When evaluating fixes that attach defaults to ray-payload field decorations: check that the fix runs over **all** `IRRayPayloadDecoration` structs, not just structs reached via the `__forceVarIntoRayPayloadStructTemporarily` legalize path. The latter misses separately-compiled hit shaders and is a real bug class for shader libraries.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1779364869375-slang-10267-pr-11224-coverage-gap-anyhit-only.md`_
