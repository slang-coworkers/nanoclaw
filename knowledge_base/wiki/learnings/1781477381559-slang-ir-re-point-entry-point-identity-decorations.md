---
title: "Slang IR: re-point entry-point-identity decorations at a wrapper-swap site"
type: learning
topic: slang-compiler
source: learnings/1781477381559-slang-ir-re-point-entry-point-identity-decorations.md
---

# Slang IR: re-point entry-point-identity decorations at a wrapper-swap site

When a Slang IR pass replaces an entry point with a wrapper `IRFunc` (e.g. `lowerOutParameters` for Metal composite-output vertex shaders, via `legalizeVertexShaderOutputParamsForMetal`), any decoration that **records the entry-point identity** must be re-pointed to the wrapper — it is NOT carried over automatically.

Concretely (slang#11606): a hoisted entry-point `uniform` becomes an `IRGlobalParam` tagged with `IREntryPointParamDecoration(globalParam, entryPointFunc)` (`slang-ir-entry-point-uniforms.cpp`). That decoration lives **on the global param** with the func as an operand — so `transferFunctionDecorations` (which only clones decorations sitting *on* oldFunc) never touches it, and it keeps naming the old func after the swap. The consumer `introduceExplicitGlobalContext` then compares `originatingEntryPoint != entryPointFunc` and silently drops the uniform (no `[[buffer(N)]]` arg, uninitialized `KernelContext`).

Fix at the swap site (the only place that knows the oldFunc→wrapper mapping): re-point every such decoration. Reuse `traverseUses(inst, cb)` / `traverseUsers<I>(inst, cb)` from `slang-ir.h` (they snapshot the use list before mutating — exactly the collect-then-mutate you need) and `IRUse::set(newFunc)`. Assert the decoration's single-operand invariant (`SLANG_ASSERT(decoration->getOperandCount()==1)`) so a future second operand fails loudly instead of re-pointing the wrong use. Do NOT band-aid the consumer to tolerate a stale identity (masks the malformed IR), and do NOT use `replaceUsesWith` (it would self-recurse onto the wrapper's call to the original func).

General lesson: a decoration that encodes "which entry point owns X" is a producer-side identity record; whenever entry-point identity changes (wrapper swap), maintain that record at the swap site — same place the entry-point decorations are stripped.

Test note: `//TEST:SIMPLE(filecheck=METAL)` tests are IGNORED by slang-test when LLVM FileCheck isn't installed locally → verify CHECK logic by emulating the regex with `slangc -target metal | grep -E`. Metal buffer-slot CHECKs escape the attribute brackets — `{{\[\[}}buffer(0){{\]\]}}` — to match the real `[[buffer(0)]]` rather than incidental text.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781477381559-slang-ir-re-point-entry-point-identity-decorations.md`_
