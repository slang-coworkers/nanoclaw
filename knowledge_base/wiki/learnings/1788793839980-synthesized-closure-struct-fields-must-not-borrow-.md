---
title: "Synthesized closure/struct fields must not borrow a type's name (reserved-This collision)"
type: learning
topic: misc
source: learnings/1788793839980-synthesized-closure-struct-fields-must-not-borrow-.md
---

# Synthesized closure/struct fields must not borrow a type's name (reserved-This collision)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788770254051-khwfz8
written_at: 2026-09-07T15:10:39.980Z
---

# Synthesized closure/struct fields must not borrow a type's name (reserved-This collision)

**Context:** shader-slang/slang#12923 — a lambda capturing `this` inside an interface **default method** (`InterfaceDefaultImplDecl` body) failed to compile with E30019 (type mismatch) + E30011 (not an l-value) + E30022 (while synthesizing `$init` of the closure struct). The identical lambda works in a normal struct method.

**Non-obvious root cause (the triage's IR-lowering hypothesis was wrong):** `LambdaCaptureVisitor::maybeCaptureDecl` (source/slang/slang-check-expr.cpp) names the synthesized closure field after the capture's *source decl*. For a `this`-capture the source decl is the type, and for an interface default method that type is the `This` **`GenericTypeParamDecl` literally named "This"** (created in slang-parser.cpp `parseInterfaceDefaultCallableAsExplicitGeneric`). So the closure field was named `"This"`. The compiler-synthesized member-wise constructor emits `this.<field> = param` and **re-checks it by NAME lookup**; the reserved-name special case in slang-lookup.cpp (`!as<InterfaceDecl>(declRef) && name == getThisTypeName()` → return the enclosing type itself) hijacks `this.This` to resolve to the *closure struct type*, not the field → the type-mismatch / not-an-l-value errors. A struct-method `this`-capture works only because its field is named after the struct, not "This".

**Fix pattern:** two edits, both in slang-check-expr.cpp. (1) In `visitThisExpr`'s `InterfaceDefaultImplDecl` branch, add `if (m_parentLambdaExpr) return maybeRegisterLambdaCapture(expr);` (it was missing vs the `AggTypeDeclBase` sibling). (2) In `maybeCaptureDecl`, give a captured `this` (source is a *type* decl, i.e. `!as<VarDeclBase>(srcDecl)`) a synthesized `$this` field name (`astBuilder->getNamePool()->getName("$this")`); local-var captures keep their name. Do NOT reach for the invasive "make the closure generic over This" fix — the closure is already lexically nested in the default-impl generic and outer-generic-param captures (`Wrap<T>`) already work.

**General lesson:** when synthesizing a struct/closure field, do not copy a *type's* name onto it. Member-wise `$init` synthesis re-resolves `this.<field>` by name, so a field named after a reserved type name (especially `"This"`) gets shadowed by reserved-name member lookup. Give synthesized receiver/capture slots a `$`-prefixed synthesized name. Validated: repro → cpp clean, test 3/3 (vk/cpu/cuda) = 42, lambda 26/26, interfaces 84/84.

**CI note:** a first CI run showed many red jobs that were pure transient infra (repeated `curl: 504` gateway timeouts on dependency downloads, `Insufficient disk space`, and a self-hosted GPU runner "lost communication with the server" with zero failed steps). Diagnostic tell: same-compiler *debug* builds passed while only fast-failing *release* builds went red → not code. `gh run rerun <id> --failed` is the right action, not a code change.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1788793839980-synthesized-closure-struct-fields-must-not-borrow-.md`_
