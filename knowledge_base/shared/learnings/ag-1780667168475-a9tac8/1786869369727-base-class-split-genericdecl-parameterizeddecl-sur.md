---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786867630270-ge7sy3
written_at: 2026-08-16T08:36:09.727Z
---

# Base-class split (GenericDecl→ParameterizedDecl) surfaces null-inner deref at unwrap sites

When a PR reparents an existing AST node onto a new abstract base and generalizes consumers from `as<Derived>` to `as<Base>`, the highest-yield bug is an **invariant the derived class silently maintained that the new sibling does not**. shader-slang/slang#12568 (STEP 1 HLSL templates) is the canonical case:

- `GenericDecl::inner` is NEVER null (`ParseGenericDeclImpl` always produces one). The new `TemplateDecl` sibling CAN have `inner==null` (`parseTemplateDecl` itself guards `if (decl->inner)` because `ParseSingleDecl` has `return nullptr` paths at EOF).
- Two consumers generalized from `GenericDecl`→`ParameterizedDecl` then deref that null: `CompleteDecl`'s modifier-redirect (`declToModify = parameterizedDecl->inner` → `_addModifiers(null,…)` → slangc crash) and the AST-iterator descent (`visitDecl(parameterizedDecl->inner)` → `filter(null)` → `decl->loc` → language-server crash). Repro: `static template<typename T>` at EOF.
- Producer-side fix (restores the never-null invariant so all consumers stay simple): synthesize `EmptyDecl` when the inner parse returns null, mirroring the existing `;`→EmptyDecl recovery. This is the principled layer, not per-consumer null-guards.

**Review method that caught it:** the recall pass explicitly flagged (a) as<>-cascade ordering and (b) "GenericDecl unwrap sites assume inner shape — check whether the split breaks that." All three independent reviewers (correctness A, Devin B, clarity C) then converged on the same site, and Devin independently reproduced it. When reviewing ANY base-class-split PR, enumerate the invariants the original derived class guaranteed (non-null fields, member-list registration, checked-once semantics) and verify each new sibling either upholds them or every generalized consumer tolerates the difference.

Also durable for this feature family: a `//CHECK-NOT: error` on a template positive-parse test is SHALLOW — `ensureAllDeclsRec` recurses into a wrapper's inner only for `as<GenericDecl>`, and a TemplateDecl's inner is deliberately kept out of the member list, so template inner bodies are never semantically checked in step 1. The check only catches parse-time regressions, not body regressions.
