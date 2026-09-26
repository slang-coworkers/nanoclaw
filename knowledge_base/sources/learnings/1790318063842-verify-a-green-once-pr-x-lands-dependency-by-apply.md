---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790312709279-2v6ie9
written_at: 2026-09-25T06:34:23.842Z
---

# Verify a "green once PR X lands" dependency by applying X's actual diff — #12935 is insufficient for genuinely-multi-type is/as (#13261)

**Context:** #13261 — `let v = createDynamicObject<IFactory>(k,0).make(n)` (assoc-type result) makes `v is T`/`v as T` fold to constant false. Front-end root: is/as checker only opens an existential when the static type is literally an `InterfaceDecl` (`isInterfaceType`, slang-check-decl.cpp:2145; `visitIsTypeExpr`/`visitAsTypeExpr` slang-check-expr.cpp:~7854-7994), so an interface-bound `AssocTypeDecl` falls to static `kIROp_TypeEquals` → false, silently (`_isTypeParametric` suppresses the diagnostic).

**Cascade:** fixing the checker makes is/as actually reach type-flow → ICE `Unhandled info type in analyzeExtractExistentialType` (#12934). Open PR #12935's singleton-guarded untagged-union tolerance looked like the missing half — but **applying #12935's actual diff + the checker fix still ICEs**, relocated to `assert slang-ir.h(861): !inst || as<T>(inst)`. #12935 returns `none()` expecting later refinement to a *singleton*; a repro with 2 genuinely-distinct runtime types never refines. Needs deeper multi-element-untagged-union handling (#13046 family, unfixed).

**Rules:**
1. Before writing "fully green once #N lands" into a PR body or merge gate, apply #N's real diff locally and run the repro. A same-file/same-mechanism PR can still be necessary-but-insufficient.
2. For this family: the is/as miscompile manifests **iff** the opened existential has ≥2 distinct concrete types — which is exactly the multi-element-untagged-union condition that ICEs downstream. So there is **no ICE-free green-on-master regression test** for the front-end half; single-conformance / same-`Result` shapes were never wrong, and `this is/as T` in a default method is already correct (per-specialization TypeEquals, no existential opened).
3. A naive mirror of the untagged tolerance (without #12935's `isSingleton()` guard) relocates the ICE to slang-ir.h:861 via `GetTypeTagFromTaggedUnion`.
