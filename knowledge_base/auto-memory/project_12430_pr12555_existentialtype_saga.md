---
name: project_12430_pr12555_existentialtype_saga
description: "PR #12555 (draft) — the AST-level ExistentialType work for slang#12430, tangent-vector-authorized. Spike CONFIRMED his hypothesis (dyn IV ⊄ IV rules out Repro 2 via existing E38029); he then EXPANDED scope to form dyn IV in ALL proper-type contexts + triage the ~68-file failure set. Live PR/review saga split out of project_12430_existential_static_requirement_ice when that leaf hit the read bound."
metadata: 
  node_type: memory
  type: project
  originSessionId: ca41560b-b199-4c60-94f8-8afbca9f7f07
---

# slang#12430 PR #12555 — AST-level ExistentialType (`dyn IV`) saga

Parent chain + root-cause analysis: [[project_12430_existential_static_requirement_ice]].
This leaf holds the **live PR/review saga** only. Owned downstream: `slang-fixer` (PR + maintainer
edge), `slang-reviewer` (review). Main (me) does not re-dispatch — I record + report up.

## Origin & authorization

`tangent-vector` (Tim Foley, Slang language designer) tasked `@nv-slang-bot` directly on #12430
(cmt `5299401967`, 08-15 00:12Z) to build a design-spike draft PR adding an AST-level `ExistentialType`
and validate it rules out Repro 2. Report-back to the issue is authorized (he asked). Draft PR #12555
opened (`fix/issue-12430` → master, author `nv-slang-bot`), mapped for webhook routing (owner
`slang-fixer` sess `…d1mkxe`).

## ⭐ Spike result — Tim's hypothesis CONFIRMED (head `9c0246f3`, 04:15Z)

AST-level `ExistentialType` (`dyn IFoo`), made non-conforming to `IFoo`, rules out **Repro 2**
(`callStatic<IV>()`) at type-check → emits existing **`E38029`** ("type argument 'dyn IV' does not
conform to interface 'IV'") instead of the `irWitnessTable` ICE. **No new diagnostic.** Generic form of
Repro 1 also fixed; **bare `IV.dzero()` NOT** (static-member-access base, not a generic arg — separable
increment, matches Tim's hedge). Spike suites all passed (generics 251/251, interfaces 75/75, autodiff
900/900, dyn-dispatch 695/695); #10892 reciprocal unchanged.
⭐**Quantified key finding:** the FULL rule (existential in all contexts) broke **68** base files —
forming it for unconstrained container params turns `Optional<IFoo>` into `Optional<dyn IFoo>` and
`dyn IFoo` isn't member-transparent in the checker. Narrowing to conformance-CONSTRAINED `T:IFoo` was
the clean slice: 68 → 0.
✅**CI VERIFIED by me — the `ci_failed` webhook is cosmetic:** on `9c0246f3` every build/test job
`completed/skipped`, sole non-skip `check-ci: failure` (human-priority yield on `workflow_dispatch`).
Pulled the check-runs myself; not relayed on the fixer's word.

## ⛔ SCOPE EXPANDED — Tim wants the systematic change (cmt `5300868123`, 06:08Z, verified verbatim)

*"`Optional<IV>` is 100% intended to semantically mean `Optional<dyn IV>` (and the same for arrays,
buffers, etc.). … get rid of the hacky special case … and instead properly apply that rule in ALL
contexts where a proper/data type is expected/needed. … triage the test cases that fail … identify
root causes … Report your findings here and I will help determine next steps."*
⇒ **The 68-file blast radius is now the WORK, not a warning.** He confirms the broad rule is
semantically intended, will investigate the bare-`IV.dzero()` case himself, and wants a **triage**, not
a merge-ready fix. Chokepoint confirmed by his inline review comment `3788755792` (06:42Z on
`slang-check-conformance.cpp`): *"an interface … is not a proper type, while an existential type is"* →
put the coercion in `CoerceToProperType`/`tryCoerceToProperType`.

## Review — COMPLETE but HELD (08-15 06:14Z, `slang-reviewer`)

3 reviewers (A 0 bugs/2 gaps/2 Qs, B Devin + C clarity clean; no GitHub post — no
`<github-post-authorized/>`). Verdict on the narrow-gate diff = **APPROVE_WITH_NITS** (mechanism sound,
no correctness bug) — **NOT final, NOT posted, deliberately held** because the diff is being rewritten
to the full rollout; will re-run on the fixer's re-push. Findings surviving the rewrite:
- ✅**My flagged `visitExistentialType` question CONFIRMED:** dead code under the narrow gate, **flips
  to LOAD-BEARING under the full rollout** (as does the guard's `superType` disjunct). Reviewer sent the
  fixer a survives-vs-invalidated forward map for the rebuild.

## ✅ TRIAGE DELIVERED + PUSHED — 08-15 07:52Z (fixer-reported; ✅ = I verified on my edge)

Broad rule pushed: **head `9c0246f3` → `b9a9b60e`** ✅, triage comment **`5301246170`** posted to
`tangent-vector` ✅, **PR clean: file count 15→12, additions 339→196, both scratch `.md` gone** ✅
(the prior local-only state is now resolved on the public artifact; the 06:00Z auto-close-keyword
removal + these scratch files were the two standing cleanups — both done). `CoerceToProperType`/
`CoerceToProperTypeImpl` now forms `dyn IFoo` in every proper-type context; narrow gate removed; Repro 2
still rejected (E38029). One exemption to even build: constraint-supertype re-coercion broke the core
module (`float4 ⊄ dyn ITexelElement`; a constraint supertype names an interface AS an interface).

**Triage buckets (fixer-measured, ~85 failing base files — PARTIAL, runner cuts at 32 consecutive
fails), each pointing at specific missing front-end existential machinery:**
- **(a) make-existential coercion missing** [dominant]
- **(b) member-lookup not transparent on `dyn IFoo`** [dominant] — root cause: `maybeOpenExistential`
  (auto-unboxing) only matches `DeclRefType`→InterfaceDecl, so the new `ExistentialType` node isn't
  recognized. **Auto-unboxing IS real** (fixer reality-checked Tim's design comment, which Tim asked
  for).
- (c) autodiff type-mangling ICE (30 hits) · (d) is/as · (e) interface conjunctions not formed
  (`(dyn IFoo)&(dyn IBar)` → ICE) · (f) autodiff differential-type support.
- Reality-check vs Tim's design comment: his `useConstrained`/`useUnconstrained` inference matches the
  impl; the **E33180-vs-E38029 distinction he flagged is correct** — front-end rejection is E38029 via
  the conformance rule; E33180 is a separate IR-pass check that already classifies both `InterfaceType`
  and `ExtractExistentialType`. *(all fixer-measured; not re-derived by me.)*

16 codex critique rounds, all 3 stages approve. Fixer **HOLDING for Tim's direction** on two questions
it put to him: (1) sequence the (a)/(b) fixes, and (2) separate tracking issue for the "revisit E33180 +
auto-unboxing architecture" investigation vs. fold into #12430.
✅**PR description REFRESHED to the systematic state — verified by me 08:07Z** (head unchanged
`b9a9b60e`): opening now describes the in-progress `IFoo`/`dyn IFoo` split + links the triage comment,
no longer the narrow-gate spike. All owed cleanups (auto-close keyword, scratch files, description) are
now DONE on the public artifact.

**RESUME:** Tim answers the sequencing + issue-tracking questions on PR #12555 → fixer proceeds. If Tim
authorizes the (a)/(b) fixes, `slang-reviewer` re-runs on the next synchronize (its verdict is held for
exactly this re-push). This is now a **maintainer-steered multi-step fix**, not a bounded spike — Main
records + reports up; the fixer owns the PR/maintainer edge and does not need re-dispatch.
