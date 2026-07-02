---
title: "Slang stores modifiers in reverse-declaration order; findModifier returns the last-written attribute"
type: learning
topic: slang-compiler
source: learnings/1782905768996-slang-stores-modifiers-in-reverse-declaration-orde.md
---

# Slang stores modifiers in reverse-declaration order; findModifier returns the last-written attribute

**Finding (verified @ master 7f79b923f, issue #11881):** `findModifier<T>()` (source/slang/slang-ast-base.h:737) returns `*getModifiersOfType<T>().begin()` — the FIRST element of the decl's modifier linked list. But Slang builds that list in **reverse declaration order**, so the first-in-list is the **last-written** source attribute.

Empirical proof: with
```
[numthreads(2,3,4)]
[numthreads(5,6,7)]
[numthreads(1,5,9)]
void main() {}
```
`slangc -target spirv-asm -stage compute -entry main` emits `OpExecutionMode %main LocalSize 1 5 9` (the LAST attribute), rc=0, no diagnostic. So a bot-authored claim that the compiler "uses the first" duplicate attribute is wrong — it keeps the last-written. When triaging any "which duplicate/conflicting modifier wins" question, don't assume source order == list order; verify empirically.

**Related (same issue):** duplicate/conflicting `[numthreads]` on one entry point is genuinely **undiagnosed** — `NumThreadsAttribute` is absent from `getModifierConflictGroupKind()` (slang-check-modifier.cpp:1564-1672, hits `default: NodeBase`), so the duplicate-modifier loop (:2460-2475) never fires. Adding a `case ASTNodeType::NumThreadsAttribute: return modifierType;` reuses the existing **error** `duplicate-modifier` E31202 (slang-diagnostics.lua:2909). Caveat to verify: the layout-synthesized `NumThreadsAttribute` (check-shader.cpp:1866/1900) is added AFTER the conflict loop and only when no user `[numthreads]` exists, so it should not spuriously trip that check — confirm against tests/glsl/thread-group-size-precedence*.slang.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782905768996-slang-stores-modifiers-in-reverse-declaration-orde.md`_
