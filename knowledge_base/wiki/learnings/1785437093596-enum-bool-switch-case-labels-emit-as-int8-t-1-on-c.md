---
title: "enum:bool switch case labels emit as int8_t(1) on C-family targets (IRIntLit-of-bool dual representation, #12298)"
type: learning
topic: misc
source: learnings/1785437093596-enum-bool-switch-case-labels-emit-as-int8-t-1-on-c.md
---

# enum:bool switch case labels emit as int8_t(1) on C-family targets (IRIntLit-of-bool dual representation, #12298)

**Context:** shader-slang/slang#12298, a follow-up to #12260/PR #12275. Verified @HEAD a729b2b22.

**Symptom:** After #12260's front-end fold fix let `switch` on an `enum : bool` compile, the C-family emit targets that SKIP bool-switch legalization (HLSL, Metal, CUDA, C++) print case labels as `case int8_t(0):` / `case int8_t(1):` on a bare `bool` selector, instead of `case false:`/`case true:`. Functionally correct (values right, compiles, selects correct case) — a code smell, not a miscompile. GLSL/SPIR-V/WGSL are protected by `legalizeBoolSwitchForTargetsRequiringIntSwitch`.

**Root cause — a dual `IRIntLit`-of-`bool` representation (non-canonical):**
1. `lowerSwitchCases` (slang-lower-to-ir.cpp:9263-9268): `lowerType(constVal->getType())` returns the **`IREnumType`** (enums stay opaque until the dedicated pass), then calls `getIntValue(enumType, value)`.
2. `IRBuilder::getIntValue` (slang-ir.cpp:2416-2451): only a **direct** `kIROp_BoolType` operand switches the opcode to `kIROp_BoolLit` (:2439-2442). An *enum* type falls to `default:` → the label is born as a plain `IRIntLit`.
3. `lowerEnumType` (slang-ir-lower-enum-type.cpp:157-159): `key->replaceUsesWith(value->loweredType)` swaps ONLY the *type operand* (enum→bool tag) — it never rewrites the `IRIntLit` *opcode*. Result: an `IRIntLit` whose type is `IRBoolType` = a non-canonical twin of `IRBoolLit`.
4. `emitSimpleValueImpl` (slang-emit-c-like.cpp:1316-1427): the `kIROp_IntLit` handler has arms for Int8..UIntPtr but **no `BaseType::Bool` arm** → bool hits `default:` which falls into `case BaseType::Int8:` → `int8_t(...)`. The correct `true`/`false` lives in the separate `kIROp_BoolLit` arm (:1433), which this IntLit never reaches.

**Lesson / pattern:** A pure front-end fold fix (#12275 only touched `TypeCastIntVal::tryFoldImpl`) that newly makes a construct *reachable* leaves an untouched downstream tail. When an enum lowering pass rewrites a type operand via `replaceUsesWith`, it does NOT re-canonicalize constant opcodes — so `getIntValue`'s type-based opcode selection (`kIROp_BoolType`→BoolLit) is bypassed whenever the value is built while still enum-typed. This is the same "target-agnostic fold reaches all backends; each backend's legalization is the real gate" pattern seen in the WGSL bool-IntLit ICE (learning 1785375838727) — except here the C-family emitters silently mis-spell rather than ICE.

**Principled fix (reporter-preferred, RECOMMENDED):** producer-side — in `lowerEnumType`, when the erased enum's tag type is bool, rewrite the `IRIntLit` into a canonical `IRBoolLit` (not just swap the type). Consumer-side (add a `BaseType::Bool` arm to the emitter) is a band-aid that keeps the dual representation — a red flag under the repo's "fix the producer, don't mask" methodology.

**OPEN design question the fixer must verify (don't guess):** is `case true:`/`case false:` legal against a `bool` selector on DXC/MSL/nvrtc/host-C++, or should the switch be legalized to an integer switch for these targets too? This decides whether the producer fix alone suffices.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785437093596-enum-bool-switch-case-labels-emit-as-int8-t-1-on-c.md`_
