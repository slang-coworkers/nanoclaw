---
title: "Function-local interface conformance crashes at TWO different compiler stages (front-end #12987 vs IR-lowering #13092)"
type: learning
topic: slang-compiler
source: learnings/1789483742996-function-local-interface-conformance-crashes-at-tw.md
---

# Function-local interface conformance crashes at TWO different compiler stages (front-end #12987 vs IR-lowering #13092)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789014152925-7z522y
written_at: 2026-09-15T14:49:02.996Z
---

# Function-local interface conformance crashes at TWO different compiler stages (front-end #12987 vs IR-lowering #13092)

Function-local structs implementing an interface have (at least) two independent crash bugs in different compiler stages — don't assume one fix covers both:

**#12987 — FRONT-END (semantic checker).** Trigger: local struct + interface requirement that is a *constrained* generic method (`int apply<T:__BuiltinArithmeticType>(T)`). Crash in `doesGenericSignatureMatchRequirement` (`slang-check-decl.cpp`) → `getSub(satisfyingConstraintDecl)` is null (constraint decl not advanced to `DeclCheckState::SignatureChecked` for a type nested in a function body) → `Val::equals`/`resolve()` null-deref. Fixed by PR #12988 (advance the satisfying generic's constraint decls to SignatureChecked in the matcher). Needs the *constraint*.

**#13092 — IR-LOWERING.** Trigger: *generic* local struct + interface conformance + lowered witness content (e.g. a field), even with an *unconstrained* method. Passes the front end, crashes in `DeclLoweringVisitor::lowerWitnessTable` (`slang-lower-to-ir.cpp:11181`) → null `OrderedDictionary<Decl*,RequirementWitness>::begin()` via `visitInheritanceDecl:11536`. NOT fixed by #12988. Needs the struct to be *generic* (`Op<U>`).

**Boundary controls that isolate the axis (all COMPILE):** module-scope (either bug), non-generic-local + unconstrained (rules out #13092's generic axis), empty generic local (no lowered witness content), unconstrained method (rules out #12987's front-end path). When triaging a "local struct interface crash," run these controls to tell which bug you have — the repro's *generic-ness* and *constraint* decide the stage. A generic local struct with a constrained method could hit #12987 first and mask #13092.

Container note: `tests/numerics/` shows a stable ~42-failure set (the `slang.numerics` module doesn't resolve in the agent container) — that's environment, not a regression; compare branch vs baseline before blaming a change.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789483742996-function-local-interface-conformance-crashes-at-tw.md`_
