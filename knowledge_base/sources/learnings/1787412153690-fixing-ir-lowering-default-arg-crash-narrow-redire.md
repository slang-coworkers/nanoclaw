---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787182538661-e8klo7
written_at: 2026-08-22T15:22:33.690Z
---

# Fixing IR-lowering default-arg crash: narrow redirect-gated fallback, not a wholesale declRef swap

Context: slang #12640 — calling a method on a concrete value crashes when a default arg is declared on the interface requirement but the satisfying method omits it (assert slang-lower-to-ir.cpp `argExpr`; Release = null-deref UB via SLANG_ASSERT→SLANG_ASSUME).

**Trap 1 — a "read the arg source from the requirement declRef" fix must be NARROW.** The tempting fix is to make `addDirectCallArgs` enumerate ALL arguments from `resolvedInfo.funcDeclRef` (the overload-selected requirement) instead of the witness-resolved callee. This REGRESSES the core-module compile: `.resolve()` carries substitutions (generic args, canonicalization) that the wholesale swap discards, so ordinary generic/default calls throughout core.meta mis-substitute and slang-bootstrap aborts. Proven by a revert-control on the SAME HEAD (revert the 2 lines → core module compiles in ~20s; apply → InternalError). Correct form: pass the selected declaration as an OPTIONAL `defaultArgSource` ONLY when it differs from the witness-resolved callee (`resolvedInfo.funcDeclRef.getDecl() != funcDeclRef.getDecl()`), so ordinary calls take the unchanged path.

**Trap 2 — a null-only per-parameter fallback is INCOHERENT for mixed defaults.** If the fallback triggers only when the impl param's own initExpr is null, then for `IFoo::f(a=1,b=2)` implemented by `Foo::f(a, b=20)`, `f()` yields (1,20) — mixing the requirement's default for `a` with the impl's for `b`. But the call was type-checked against the requirement's signature, so (1,2) is the coherent answer. Make the selected declaration authoritative for ALL its omitted args, not just those the impl left null.

**Trap 3 — This-dependent defaults are a SEPARATE checker-side defect.** A requirement default that references another requirement member (`= kDefault`) is NOT resolved through the concrete witness by `_lowerSubstitutionEnv` (which only handles GenericAppDeclRef), so it lowers to the interface's abstract constant → downstream operand assert. This is pre-existing (crashes identically on clean master with the fix removed) — scope it OUT of a targeted crash fix, file a tracked follow-up, and reject a lowering-time diagnostic (consumer-side band-aid over a producer-side bug). The proper fix is checker-side default materialization with This-substitution.

**Method that worked:** the revert-control (same worktree, revert only your change, rebuild the minimal target — slang-bootstrap — and re-run the failing step) is the fastest, most decisive causation test when a fix might have caused an unrelated build failure. Always run it before assuming a regression is or isn't yours.
