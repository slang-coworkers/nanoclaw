---
title: "[approver/challenger-miss] A type-emitter diagnostic can't guard an overload that lacks the type operand — check parallel no-operand sites after a 'fixed' regression"
type: learning
topic: review-approval
source: learnings/1784047648527-approver-challenger-miss-a-type-emitter-diagnostic.md
---

# [approver/challenger-miss] A type-emitter diagnostic can't guard an overload that lacks the type operand — check parallel no-operand sites after a "fixed" regression

**Symptom.** shader-slang/slang#12089 rev3 fixed the rev2 🔴 (bare `hlsl_nvapi` + pre-SM6.9 aborting the compiler) by adding a clean diagnostic (error 55215 `HitObjectRequiresSerCapability`) in the `kIROp_HitObjectType` emitter — it fires whenever a `HitObject` type is emitted without SM6.9 or `nvapi_hit_objects`. Good fix. But the production review found (and I verified) a NEW 🔴: the `ReorderThread(uint, uint)` overload — which takes **no** `HitObject` operand — still silently emits SM6.9-only `dx::MaybeReorderThread` on `sm_6_5 + hlsl_nvapi` (where pre-PR it emitted `NvReorderThread`). The diagnostic is keyed on emitting the `HitObject` *type*; an SER op with no `HitObject` in its signature never triggers it, so it silently miscompiles.

**Root cause / transferable rule.** When a capability-narrowing regression is fixed by a guard/diagnostic on a TYPE emission (or any single chokepoint), that guard only protects code paths that actually go through the chokepoint. Sibling operations in the same family that DON'T carry that type (here: the no-HitObject ReorderThread overload; contrast the two HitObject-taking overloads which DO trip 55215 via their param type) are left uncovered. After a "regression fixed" revision, the challenger should: enumerate every operation in the affected family (all `__target_switch` sites that were re-gated coarse-atom → narrow-atom), and for each ask "does this op route through the new guard? if not, does the bare-coarse-atom + wrong-profile config still silently pick the SM-gated native arm?" The silent ones (no diagnostic, wrong codegen) are worse than the crash that was fixed.

**How to catch it.** For an atom-narrowing PR, grep the meta file for every `case <coarse_atom>:` → `case <narrow_atom>:` migration and every `[require(<narrow_atom>, ...)]`; for each `__target_switch` with both `case <narrow_atom>:` and `case hlsl:` (or any SM-gated native arm), the config `coarse_atom + pre-SM-profile` selects the native arm. If that op has no type operand that would trip an emitter-side diagnostic, it's a silent-regression candidate — verify against the base file's pre-PR arm.

**Disposition.** On #12089 rev3 the recorded enum was ABSTAIN_POLICY / CLAUSE_FAIL:no_protected_paths (Step-1 terminal — the PR also added protected source/slang/CMakeLists.txt); the 🔴 was corroborating. But the 🔴 would independently drive BLOCK. See [[pr-12089-decided-rev-ce42d01f]] and the check-cmdline-ref clause-gap learning. Also reinforced: debounce discipline across a 5-push churn storm on rev2 and one more push here — always re-anchor + wait for CI to COMPLETE.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784047648527-approver-challenger-miss-a-type-emitter-diagnostic.md`_
