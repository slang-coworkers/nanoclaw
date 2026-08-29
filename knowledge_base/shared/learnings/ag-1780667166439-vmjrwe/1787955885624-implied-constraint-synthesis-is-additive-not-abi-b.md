---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787955130382-hktmu9
written_at: 2026-08-28T22:24:45.624Z
---

# Implied-constraint synthesis is additive, not ABI-breaking, when it only fires on programs that error today

Task: slang#12826 — infer implied `where` constraints from constrained generic type applications (`void f<T>(Bar<T>)` with `struct Bar<F:IFoo>` → synthesize `where T:IFoo`).

**Verified plumbing fact:** a generic's constraint set IS its `GenericTypeConstraintDecl` member list; body-lookup (`_getInheritanceInfo`), mangling (`getCanonicalGenericConstraints2` → `slang-mangle.cpp`), AST serialize (`slang-serialize-ast.cpp` takes the whole member list), and IR lowering (`emitGenericDecl`, gated by `isGenericConstraintParameterDecl`) all read it via `getMembersOfType<GenericTypeConstraintDecl>`. So a synthesized constraint member added onto the outer `GenericDecl` (mirror the conjunction-flatten producer at slang-check-decl.cpp:~4444: `create → set sub/sup/parentDecl → addDirectMemberDecl → ensureDecl(SignatureChecked)`) propagates with ZERO extra wiring. Inject from `visitGenericDecl` (slang-check-decl.cpp:~4709) after params are ReadyForReference, before the E38029 reject site (`TryCheckOverloadCandidateConstraints` slang-check-overload.cpp:1303) fires. There is NO existing "walk a TypeExp and collect its constrained generic applications" helper — that walk is the genuinely new code.

**The non-obvious ABI insight (contra a first-pass "adding a constraint changes the mangle ⇒ pr: breaking"):** yes, constraints are part of the mangle. BUT implied-constraint inference fires ONLY where an unconstrained param with no witness is used in a constrained application — i.e. EXACTLY the programs that ERROR today (can't even be declared). So it never changes the mangle of any program that compiles now, and never turns valid code into an error; it strictly enlarges the accepted set. That makes it **additive/monotonic ⇒ argue `pr: non-breaking`**, not breaking. General rule: before labeling a mangling/representation change "breaking," ask *whose currently-compiling program's symbol actually changes?* If the only affected inputs are ones that don't compile today, the change is additive. (Maintainer still owns the final ABI-policy call — some teams label any mangling-surface touch breaking out of caution.)

Distinct from #4699/#4729 (those FIND an already-satisfiable conditional witness via check ordering; #12826 SYNTHESIZES a missing constraint).
