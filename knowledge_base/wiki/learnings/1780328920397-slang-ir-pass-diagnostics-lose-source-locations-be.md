---
title: "Slang IR-pass diagnostics lose source locations because struct keys inherit IRBuilder's incidental loc"
type: learning
topic: slang-compiler
source: learnings/1780328920397-slang-ir-pass-diagnostics-lose-source-locations-be.md
---

# Slang IR-pass diagnostics lose source locations because struct keys inherit IRBuilder's incidental loc

## Symptom
Warnings emitted from Slang IR passes (e.g. E41021 `field-not-default-initialized`, E31106/E31107 param-group leaks) sometimes print with **no file:line**. The rich-diagnostics renderer (`span { loc = ... }`, slang-rich-diagnostics-render.cpp) **silently omits file:line + code snippet** when the resolved `SourceLoc` has `line == 0` — no assert, no fallback. So an empty loc input → bare warning header.

## Root cause pattern (general, not just one diagnostic)
IR-pass diagnostics derive their location from an IR instruction's `sourceLoc`. Those insts are often **synthesized / legalized / link-time-cloned** and carry an empty loc. Concretely for E41021 (#11395): IR struct keys are created in `lowerMemberVarDecl` (source/slang/slang-lower-to-ir.cpp, ~line 12272) via `builder->createStructKey()`, which **never sets the key's `sourceLoc` from `fieldDecl->loc`**. The key just inherits whatever loc the `IRBuilder` incidentally holds at that moment — populated in simple single-file lowering, **empty in complex (linked/specialized/transitively-synthesized) paths**.

## The "can't reproduce with a small shader" tell
Because the loc comes from the IRBuilder's *incidental* position, **simple repros emit correct locations while complex shaders don't**. I tested simple ConstantBuffer<S> + Texture2D/Sampler, nested structs, generics, arrays, and multi-file imports for E31106/E31107 — all showed correct file:line. So for this bug class, "reporter couldn't make a small repro" is expected, not a dead end. Ask for the real shader / a reduced repro.

## Fix directions
1. **Root cause (preferred):** set the inst's loc from its origin decl at creation — e.g. wrap `createStructKey()` in `IRBuilderSourceLocRAII(builder, fieldDecl->loc)` or assign `inst->sourceLoc = decl->loc`. Benefits all consumers (debug info + every diagnostic using that inst's loc).
2. **Fallback at emission site:** when the primary loc is invalid, fall through to a sensible secondary (field->sourceLoc → enclosing struct/type loc → function/return loc, or the global-param loc for layout diagnostics). `findFirstUseLoc` (slang-ir-util.cpp:~423) already does a use-walk fallback but still returns empty when all uses are synthesized.

## Watch-out
A behavioral change elsewhere can *surface* a latent missing-loc weakness in bulk. #11395's E41021 ×10 was surfaced (not introduced) by #11327, which made many more synthesized default ctors exist; the warning only fires for synthesized+used ctors. When triaging "regression" diagnostics, check whether the emission code actually changed vs. whether something upstream now exercises a long-latent path.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780328920397-slang-ir-pass-diagnostics-lose-source-locations-be.md`_
