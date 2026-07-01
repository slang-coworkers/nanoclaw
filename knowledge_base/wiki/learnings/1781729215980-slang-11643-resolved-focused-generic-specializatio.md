---
title: "slang #11643 RESOLVED — focused generic-specialization diagnostics landed (PR #11656), 3 of ~9 sites done"
type: learning
topic: slang-compiler
source: learnings/1781729215980-slang-11643-resolved-focused-generic-specializatio.md
---

# slang #11643 RESOLVED — focused generic-specialization diagnostics landed (PR #11656), 3 of ~9 sites done

Follow-up to the earlier learning on the E39999 / `GenericArgumentInferenceFailure` mechanism. Issue #11643 (csyonghe's enhancement extending his PR #11571) was resolved via **draft PR #11656** ("Focused diagnostics for failed generic specialization", head `fix/issue-11643`, held for maintainer review). Maintainer settled the design as **Approach A**: keep the tagged union, add a `Kind`+payload per case, capture cheap structured fields at the failure site, and **defer diagnostic formatting** to `CompleteOverloadCandidate` (since not all specialization failures become user-visible).

**What landed (3 of the ~9 null-declref sites):**
- arity mismatch → new diagnostic **E30438**.
- ordinary type/value param unsolved (incl. return-position-only `T`, value `N`) → new **E30439**. Wired at TWO sites: `areOrdinaryConstraintsSatisfied` AND `areFinalArgsValid` (`slang-check-constraint.cpp`).
- interface conformance not satisfied → **reuses existing E38029** (not a new code).
Each replaces the E39999 fallback + adds a `GenericSignatureTried` note. Union grew 3 `Kind`s + payloads + `set*()`/copy placement-new helpers in `slang-check-impl.h` (placement-new lifetimes matter once payloads aren't same-shape PODs).

**Two non-obvious implementation facts for whoever extends to the remaining sites:**
1. The **conformance/witness capture must live in `trySolveSubtypeWitnessForConstraint`**, NOT at `areFinalArgsValid:2704` — witness failure happens DURING the solver work list, before `areFinalArgsValid` runs. Gate it three ways to avoid spurious/dup E38029: **concrete sub/sup only** (no speculative-overload noise), **non-equality constraints only** (`trySolveSubtypeWitnessForConstraint` also handles `where T==X`, whose RHS is a concrete type not an interface), and **first-reason-wins**.
2. These captures **also fire on invalid default-argument-substitution paths** (e.g. `extension-visibility.slang`, `generic-default-solver-failure.slang` now surface E38029/E30439 instead of E39999 — strictly better on already-invalid programs, but a behavior change). If a maintainer wants the new diagnostics limited to *inferred-argument* failures only, the guards are narrowable — flagged as a judgment call in the PR process report.

Validation: 5 new repro tests pass (incl. an equality-constraint regression checking E39999 stays neutral via CHECK-NOT); broad regression 782/782; codex CODE_REVIEW approve over 3 rounds. The autodiff caller `slang-check-overload.cpp:3168` (`outFailure=nullptr`, drops failures) was left untouched — still the place to wire if those paths ever need focused diagnostics.

Routing note for the chain: a draft-held fix PR does NOT close the issue or surface prominently, so the triaging tier posts the issue 5-bullet (verdict: fix in draft PR #N, held pending review); merge stays operator-gated even after reviewer approve.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781729215980-slang-11643-resolved-focused-generic-specializatio.md`_
