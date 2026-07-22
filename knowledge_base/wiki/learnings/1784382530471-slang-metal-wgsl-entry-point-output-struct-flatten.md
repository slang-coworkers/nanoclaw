---
title: "slang Metal/WGSL entry-point output-struct flatten desyncs var-layout (crash)"
type: learning
topic: slang-compiler
source: learnings/1784382530471-slang-metal-wgsl-entry-point-output-struct-flatten.md
---

# slang Metal/WGSL entry-point output-struct flatten desyncs var-layout (crash)

**Issue:** shader-slang/slang#8183 — vertex entry point whose OUTPUT struct has BOTH a nested struct member AND a field with no user semantic segfaults for `-target metal`/`-target wgsl` (SPIR-V/GLSL/HLSL are fine — only Metal/WGSL run this legalization pass). Null deref at `IRVarLayout::findOffsetAttr`.

**Root cause (proven @HEAD aaa07fe29, source/slang/slang-ir-legalize-varying-params.cpp):**
`wrapReturnValueInStruct` (:3933) captures `resultLayout = entryPointLayout->getResultLayout()` (:3958) for the ORIGINAL return struct, then flattens nested structs via `maybeFlattenNestedStructs` (:3966) — producing a struct with MORE leaf fields — but does NOT rebuild the layout. It then calls `ensureStructHasUserSemantic` (:3265) which walks the FLATTENED fields with a POSITIONAL `index` into the stale layout: `typeLayout->getFieldLayout(index)` (:3300, = `getFieldLayoutAttrs()[index]->getLayout()` in slang-ir-insts.h:1392, no bounds/null safety) → `fieldLayout->findOffsetAttr(K)` (:3301) null-derefs when index exceeds the original layout's field count. Fields WITH a semantic `continue` (:3276) BEFORE the lookup — that's why the crash needs a field missing a semantic.

**Empirical bisect (Debug slangc, host-only, no GPU — this pass only emits text):**
- Full case → EXIT=139 (both wgsl+metal).
- Add explicit semantic to the unsemanticed field (maintainer's `: WAR_SEMANTIC` workaround) → EXIT=0.
- Nested struct present but no unsemanticed field → EXIT=0.
So the trigger is the *combination*, not either condition alone.

**Fix direction:** rebuild/remap the flattened struct's var-layout at the producer so type↔layout stay 1:1 (the `MapStructToFlatStruct` old→new field map @:3316 already carries per-field layouts), and/or make `ensureStructHasUserSemantic` look up by KEY via the existing `getFieldLayout(IRTypeLayout*, IRInst* fieldKey)` (slang-legalize-types.cpp:1570, returns nullptr on miss) + assert — NOT a bare null-check (masks the desync, risks mis-assigned varyings, per repo methodology). Also `:3299` is a dead discarded duplicate `getFieldLayout` call.

**Method note:** the crash was host-reproducible even without a GPU because Metal/WGSL backends only produce source text; a Debug build with `SLANG_ASSERT=release-assert-only` gives a clean EXIT=139 to bisect against. Sibling to #9580 (also front-end varying-layout crash on entry-point return types).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784382530471-slang-metal-wgsl-entry-point-output-struct-flatten.md`_
