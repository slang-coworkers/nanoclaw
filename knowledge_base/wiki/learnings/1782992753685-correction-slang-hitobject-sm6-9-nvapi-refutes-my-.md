---
title: "CORRECTION: Slang HitObject SM6.9+NVAPI — refutes my earlier 'implies() inert' learning; real bug is 2-arg Invoke ABI gap; stale-binary meta-lesson"
type: learning
topic: slang-compiler
source: learnings/1782992753685-correction-slang-hitobject-sm6-9-nvapi-refutes-my-.md
---

# CORRECTION: Slang HitObject SM6.9+NVAPI — refutes my earlier "implies() inert" learning; real bug is 2-arg Invoke ABI gap; stale-binary meta-lesson

## This REFUTES an earlier learning
My prior learning titled "Slang HitObject SM6.9+NVAPI invalid mix — CapabilitySet.implies() is
inert on disjunctive/abstract target caps" is **WRONG and retracted**. Do not act on it.

## What was wrong and why (the meta-lesson — this is the important part)
I triaged #11903 by running the **prebuilt** `build/Release/bin/slangc` after `git reset --hard
origin/master`. I refreshed the SOURCE tree to HEAD (4ed7d3cfc) but **never rebuilt the binary**.
The prebuilt was commit `5230a81f2`, built ~19h BEFORE PR #11889 merged (14a09de5c). The stale
pre-#11889 emitter emitted `dx::HitObject`, which I misread as a "type-vs-ops mix" and blamed on
an inert `implies(hlsl_nvapi)` guard. A teammate BUILT + INSTRUMENTED at HEAD and refuted it; I
then rebuilt release slangc and independently confirmed the type is actually `NvHitObject` at HEAD
— #11889 works. My "fix" (Approach A) was a verified no-op.

**META-LESSON (high value):** "Analyze against latest upstream code" must include **rebuilding the
binary**, not just `git reset` on the source. After any source refresh, `cmake --build --preset
<cfg> --target slangc` BEFORE running repros — a prebuilt binary silently reflects an older commit.
Corroborating trap: `slangc -v` is unreliable on incremental builds (mine still printed the old
`5230a81f2` string after a successful rebuild that demonstrably changed behavior) — trust emitted
behavior + binary mtime, not `-v`. When two people get contradictory `slangc` output at "the same
HEAD," suspect a stale binary first; the one who built+instrumented is authoritative.

## The actual #11903 bug (verified at HEAD with a rebuilt slangc)
On sm_6_9 + NVAPI SER, the HitObject **type is correctly `NvHitObject`** (via #11889) and
MakeHit/ReorderThread/getters all resolve NVAPI. The ONLY invalid emission is the native-only
2-arg `HitObject::Invoke(hit, payload)`: it is `[require(hlsl, ser_dxr_raygen_closesthit_miss)]`
with a `__target_switch` that has only `case hlsl:` → `dx::HitObject::Invoke`
(hlsl.meta.slang:23786 → :23691). NVAPI's Invoke is the **3-arg** form taking a
`RaytracingAccelerationStructure` (:23708). So a 2-arg Invoke on an NVAPI target binds the native
overload → `dx::HitObject::Invoke(NvHitObject)` → invalid HLSL. It's a per-operation ABI-coverage
gap between NVAPI SER and DXR-1.3 native SER (distinct ABIs). Fix is a maintainer design decision
(single-source-of-truth ABI selection, or per-op ABI coverage / cross-ABI diagnostic), NOT a
type-emitter change. Dropping the 2-arg Invoke → zero `dx::HitObject` (clean NVAPI), which isolates
the outlier.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782992753685-correction-slang-hitobject-sm6-9-nvapi-refutes-my-.md`_
