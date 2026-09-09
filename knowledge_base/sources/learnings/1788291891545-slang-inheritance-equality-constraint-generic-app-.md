---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788291055128-s210so
written_at: 2026-09-01T19:44:51.545Z
---

# Slang inheritance: equality-constraint generic-app sup re-enters via tryResolveConstraintTypes (pre-existing, orthogonal to PR #12690)

While adjudicating a Devin flag on PR #12690 ("Avoid checking unrelated subtype constraints during inheritance", fixes #12659), confirmed a **real, pre-existing re-entrancy bug** in `source/slang/slang-check-inheritance.cpp` that PR #12690 does NOT cover.

**Symptom:** A dependent equality constraint whose super-type is a *constraint-bearing generic application* depending on a sibling associated type is wrongly rejected with spurious `E38029 "type argument does not conform to the required interface"`. Minimal repro:
```slang
interface IContext { int getValue(); }
interface IConsumer<T> where T : IContext { int consume(T c); }
struct Wrapper<T> where T : IContext { T inner; }
interface ILayout {
    associatedtype Context : IContext;
    associatedtype First : IConsumer<Context>;   // forces Context's inheritance in-progress
    associatedtype Alias;
    __constraint Alias == Wrapper<Context>;       // spurious E38029 on 'Context'
}
```
Order-dependent: compiles clean if no directed sibling forces `Context`'s inheritance to be in-progress while the equality is scanned. Same re-entrancy class as #12659.

**Root cause / trace:** `SharedSemanticsContext::tryResolveConstraintTypes` (slang-check-inheritance.cpp:469) eagerly resolves BOTH endpoints of an equality. Its `resolveLeafOrDefer` helper defers only a `MemberExpr` (multi-level access `T.A.C`), NOT a `GenericAppExpr`. So a generic-app sup `Wrapper<Context>` is resolved eagerly via `TranslateTypeNodeForced` → checks `Context : IContext` → re-enters `_calcInheritanceInfo(Context)` while it is in-progress (empty placeholder cache) → spurious E38029. PR #12690 only moved the `ensureDecl` call after the new relevance prefilter (curing the *directed* super-type re-entrancy); `tryResolveConstraintTypes` is unchanged and runs BEFORE the prefilter, so the equality path is untouched.

**Adjudication technique that worked well & cheaply:** The PR's only source change was one file, and the current checkout's copy of that file was byte-identical to the PR base — so I overlaid the PR-head file onto the checkout and did a 1-file incremental Release rebuild (~2.5 min each way) instead of a full worktree build. Building both pre-PR and PR-fixed `slangc` and running the same repro on each cleanly separates "introduced by PR" from "pre-existing latent" — and confirming a spurious diagnostic is order-dependent (compiles under a different declaration order) is the decisive test that it's re-entrancy, not a genuine conformance gap.

**Gotcha:** An *interface*-typed equality sup (`Alias == IConsumer<Context>`) is independently rejected as `E30404 "not a proper type to use in a generic equality constraint"` — so to demonstrate the re-entrancy you must use a generic-app **struct** sup, not an interface.
