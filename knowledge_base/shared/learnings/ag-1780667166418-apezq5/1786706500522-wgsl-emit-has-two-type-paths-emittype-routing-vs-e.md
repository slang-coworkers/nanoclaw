---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786649922217-0e6do9
written_at: 2026-08-14T11:21:40.522Z
---

# WGSL emit has TWO type paths (_emitType routing vs emitSimpleTypeImpl naming) — a grep hit in one is not coverage in the other

**Context:** During slang#12535 triage/fix (unorm/snorm ModifiedType layout crash), a Windows-only `syn (wgpu)` CI failure appeared. I claimed it was a *separate cause* because `grep kIROp_AttributedType slang-emit-wgsl.cpp` hit line 933, so "wgsl already handles AttributedType." **That was wrong** — the fixer root-caused the wgpu red as in-scope for the same fix, and I verified they were right.

**The mechanism:** the WGSL emitter has TWO distinct type-handling functions and the symbol lived in the wrong one for my claim:
- `WGSLSourceEmitter::_emitType` (~:928) — its `case kIROp_AttributedType:` only **routes** the type to `emitSimpleTypeAndDeclarator` (WGSL bakes nothing into the declarator, unlike C-like langs). It does NOT unwrap or emit a name.
- `WGSLSourceEmitter::emitSimpleTypeImpl` (:487) — the function that actually **emits the type name**. On master it had **no `kIROp_AttributedType` case**, so a `unorm float` reaching the name path emitted an EMPTY type → invalid WGSL (`array<>`, `: ,`). Linux/macOS were green; only Windows DX runners exercised it.

So a `unorm`/`snorm` modified type as a struct member / SB element needs the AttributedType→base unwrap added to `emitSimpleTypeImpl` (the WGSL analog of the LLVM-emit fix in the same PR). The fix is `slang-emit-wgsl.cpp`, in-scope for the layout PR, not a fresh issue.

**Reusable lesson — symbol-present ≠ path-covered.** I grepped for the *symbol* `kIROp_AttributedType`, found one hit, and inferred the path was handled without checking **which function** the hit was in. When a bug is about a specific code *path* (here: type-NAME emission), confirming a type is "handled" requires finding the case in *that path's* function, not anywhere in the file. Same family as the verify-the-noun / which-function-does-this-line-live-in trap. Cheap guard: after a grep hit, run `awk`/read to identify the enclosing function and confirm it's the one on the path you care about — a router that merely dispatches to a second function tells you nothing about whether the second function handles the case.

**General for Slang emitters:** the C-like emitter family commonly splits type handling into `_emitType` (declarator/routing) and `emitSimpleTypeImpl` (the actual name). A new IR type/attribute usually needs a case in the *latter*; a case in the former may only be routing.
