---
title: "Slang HitObject SM6.9+NVAPI invalid mix — CapabilitySet.implies() is inert on disjunctive/abstract target caps"
type: learning
topic: slang-compiler
source: learnings/1782986638349-slang-hitobject-sm6-9-nvapi-invalid-mix-capability.md
---

# Slang HitObject SM6.9+NVAPI invalid mix — CapabilitySet.implies() is inert on disjunctive/abstract target caps

## Symptom (shader-slang/slang#11903, verified at HEAD 4ed7d3cfc)
On an HLSL `sm_6_9` target that ALSO has NVAPI SER in scope, `HitObject` codegen emits an
**invalid mix**: the HitObject *type* comes out native `dx::HitObject`, but operations like
`MakeHit`/`ReorderThread` come out as NVAPI functions (`NvMakeHit`/`NvReorderThread`) which
require the NVAPI `NvHitObject` type. DXC-invalid.

Repro (CPU-only textual HLSL emission — no GPU/DXC needed to see the mismatch):
`slangc x.slang -target hlsl -entry rayGenerationMain -stage raygeneration -profile sm_6_9 -capability ser`
(also `-capability ser_nvapi`). With `-capability ser_dxr` or plain `-profile sm_6_9` you instead
get an internal `E41011 __target_switch has no compatible target`.

## Root cause / general gotcha
Native-vs-NVAPI is decided by TWO independent mechanisms that can disagree:
1. **Type name** — `HLSLSourceEmitter::emitSimpleTypeImpl`, `case kIROp_HitObjectType`
   (`source/slang/slang-emit-hlsl.cpp:1964-1990`).
2. **Each operation** — a `__target_switch { case hlsl_nvapi:...; case hlsl:...; }` in
   `hlsl.meta.slang`; where a `case hlsl_nvapi:` exists it wins (more-derived atom).

PR #11889 ("prefer NVAPI HitObject over DXR 1.3 native", merged 2026-07-01, commit 14a09de5c)
tried to align (1) to (2) by checking nvapi first via
`targetCaps.implies(CapabilitySet(CapabilityName::hlsl_nvapi))` at slang-emit-hlsl.cpp:1972.
**That guard evaluates FALSE on any sm_6_9 target** — the effective/target capability set is
abstract/disjunctive (it still admits the native SER path), and `implies(X)` on a disjunction
is only true if *every* disjunct implies X. So the reorder is INERT, the type falls to
`dx::HitObject`, and the ops still resolve NVAPI → mix.

## Transferable lesson
`CapabilitySet::implies(atom)` answers "does the WHOLE (possibly disjunctive/abstract) set
*entail* this atom" — NOT "is this atom present/available in the set". When the target caps
are abstract (profile + broad `-capability ser`), `implies(vendorAtom)` returns false even
though the vendor atom is one of the resolvable options and the per-inst `__target_switch`
WILL pick it after specialization. If an emitter's type-level decision must match how the
intrinsics' target-switch resolves, use an atom-PRESENCE/intersection query (or the resolved
entry-point capability), not `implies()`. Watch for this any time a single emit-time
`implies()` gate is expected to mirror per-operation `__target_switch` selection.

Filed as #11903 (Dev Opened, RTR, skallweitNV); triaged to slang-fixer as bug-completion of
#11889 (Approach A: fix the presence check; Approach C: loud diagnostic for unresolvable combos).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782986638349-slang-hitobject-sm6-9-nvapi-invalid-mix-capability.md`_
