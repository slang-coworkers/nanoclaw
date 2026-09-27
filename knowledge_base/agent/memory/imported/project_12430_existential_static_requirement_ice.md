---
name: project_12430_existential_static_requirement_ice
description: "slang#12430 (our own bot filing, 08-08): two release-live ICEs when an existential reaches a static interface requirement inherited from a base interface and returning the base's associated type. Root cause (Tim Foley): `dyn IV` does not conform to `IV` — a missing front-end conformance rule. OPEN; fix is draft PR #12555 (see saga leaf). E33180 does not apply; #10309 fixed separately; #10892 related, dedup unresolved."
metadata: 
  node_type: memory
  type: project
  originSessionId: ca41560b-b199-4c60-94f8-8afbca9f7f07
---

# slang#12430 — existential → static interface requirement → two ICEs

**State (verified 2026-09-27):** issue OPEN; the fix is draft PR #12555 (head `e63deb8d07`,
unchanged since 09-06), awaiting `tangent-vector`'s mark-ready. The PR/review saga lives in
**[[project_12430_pr12555_existentialtype_saga]]**. Owners: `slang-fixer` (PR + maintainer edge),
`slang-reviewer`. Main records and reports; it does not re-dispatch.

**Provenance.** `slang-reviewer` filed it 08-08 while reviewing the #12429 test-only PR;
`slang-fixer` supplied the second throw site. Both reproduced independently at `716ec597fc`, so the
body is a two-edge result. The maintainer pickup (08-12, `jhelferty-nv` routing to
`tangent-vector`) was maintainer-to-maintainer and asked us nothing — the "hold for maintainer
input" path resolving as designed, not a dispatch trigger.

## The two defects — the message is the identity, not the error code

Both wrap as `E99997`, so deduping on `E99997` merges them.

| # | message (at `716ec597fc`) | layer |
|---|---|---|
| 1 | `Unexpected context type for parameter info retrieval` | `slang-ir-typeflow-specialize.cpp` (`else` arm) |
| 2 | `assert failure: slang-lower-to-ir.cpp(15156): irWitnessTable` | front-end IR lowering |

Both are release-live (`SLANG_UNEXPECTED` → `[[noreturn]] handleSignal`). ⚠️Repro 1's ICE site
**moved** later: at the PR's base it asserts `slang-ir.cpp:4013 witnessTableVal && … != kIROp_StructKey`,
so the Failure-1 message above is historical-at-`716ec597fc`. Repro 2's site did not move.

## Root cause — Tim Foley, 08-12 (cmt `5299217801`)

*"The existential type formed from an interface does not necessarily conform to that same
interface."* Both repros treat `dyn IV` as a concrete type conforming to `IV`. Repro 2
(`callStatic<IV>()`) should be rejected at type-check, because `dyn IV` does not satisfy `T : IV`.
That is a missing front-end conformance check, upstream of both IR throw sites — the IR sites are
symptoms. His design (cmt `5299401967`, carried into PR #12555; quote it, don't paraphrase it as
settled spec): `ExistentialType(iface)` = `dyn IV`, distinct from `DeclRefType`→`InterfaceDecl`;
`CoerceToProperType` on an interface forms it; `X ⊂ IY` as today, but `X ⊄ ExistentialType(IY)` and
`ExistentialType(IY) ⊄ IY`.

## The standalone repro — the naive simplification does not reproduce

Tim asked for a repro without `IDifferentiable`. Swapping it for a flat user interface exits 0.

| shape (user interfaces only) | result |
|---|---|
| static requirement with assoc-type return declared **on `IV` itself** (also constrained / self-referential assoc) | exit 0 |
| bare `IV.makeZero()`, requirement **inherited from base `IBase`**, returning the **base's** assoc type | 255, Failure 1 |
| generic `getZero<IV>()`, same inherited shape | 255, Failure 2 |
| controls: concrete `V`, or `IBase.makeZero()` directly | exit 0 |

⭐The load-bearing ingredient is the **inherited** requirement returning the base's associated type —
exactly `dzero`'s shape (`IDifferentiable.dzero() -> This.Differential`, inherited by `IV`). One
structural family yields both failures: bare form → 1, generic form → 2. A concrete-signature static
requirement is diagnosed correctly. ⛔These were measured on a stale local binary (mtime 08-04), so
they are shape facts, not SHA-attributed — rebuild before quoting a commit
([[feedback_a_repro_binary_is_not_the_sha_you_checked_out]]).

## `E33180` does not apply — category mismatch, not an unreached check

The original title said the ICE fires "instead of the diagnostic the compiler already declares".
False: `E33180` fires from `emitExistentialSpecializationDiagnostic` on an invalid existential
*specialization*, and no `specialize` inst wraps Repro 1's call at any pass. A fixer trusting the
old title would widen `E33180`'s predicate — the wrong end. The generic form *does* have a
`specialize`, which `specializeModule` consumed, accepting an existential type argument and
propagating `lookupWitness(%IV_$inheritance, …)` inward instead of rejecting it.

## Dedup

- **#10309** carries Failure 1's exact message, but its reported ICE is **fixed**: the repro now emits
  `E38207`, and `35d38d114` (#11316, first release v2026.12) ships a test saying in words that the
  construct is unsupported by policy and the fix is a clean diagnostic. Intent is demonstrated;
  internal elimination is not (the suppress-`E38207` experiment was never run). Do not merge into it.
- **#10892** is related, dedup unresolved in both directions: distinct upstream trigger
  (declaration-form sensitive), shared malformed-callee class at typeflow call handling. Its filed
  SIGSEGV was relocated by PR #11491 for #10892 and #12430 R1 at once — full bisect and the refuted
  "partial-fix artifact" framing in **[[project_10892_crash_relocated_by_pr11491]]**.

⭐**A message manufactured by a default arm is not a discriminator.** The throwing `else` arm accepts
only `IRFunc` / `IRSpecialize` / `IRSpecializeExistentialsInFunc` and collapses everything else into
the same string (`slang-ir-typeflow-specialize.cpp:4930-4948`), so the message can never separate two
shapes at that site. Read the final-pass call target instead. The two-state / positive-control dedup
instrument is in [[project_12360_assoc_type_dyndispatch_specialize_av]].

## Lessons carried elsewhere

- The six wrong claims of 08-08 and the two summary-layer errors made tallying them:
  [[feedback_a_qualitative_remark_is_not_a_denominator]] — review that re-derives from source works;
  review that reads the summary cannot catch a wrong mechanism riding a right conclusion.
- `diag=` vs `filecheck=` `// CHECK:` spacing (the triager's half-wrong caveat, retracted):
  [[feedback_an_assertion_that_cannot_fail_2026_08_07]].
- `slangc … 2>&1 | head` reports `head`'s exit status, not `slangc`'s — re-run unpiped to read 255.
- Related: [[feedback_a_diagnostics_absence_is_weaker_evidence_than_its_presence]],
  [[technique_git_log_S_in_a_shallow_clone_returns_a_false_origin]].
