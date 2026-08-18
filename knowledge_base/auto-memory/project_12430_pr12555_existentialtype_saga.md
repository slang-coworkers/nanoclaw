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

## ⭐ FULL SYSTEMATIC-REFACTOR DIRECTIVE — Tim, 08-17 20:20Z (cmt `5319797866`, verified; fixer ack `5319929857` 20:34Z)

Tim answered the sequencing question by scoping the **whole refactor**, not a subset. Directive:
**survey every `DeclRefType`→`InterfaceDecl` check in the front-end, classify each as *interface-itself*
(keep) vs *existential-box value* (convert to `ExistentialType`), implement buckets a–f PLUS the
open-existential plumbing** (`maybeOpenExistential`/`openExistential` must trigger on `ExistentialType`,
not interface type — that's root cause (b)), then report updated test results + confounding cases.
Three corrections he gave, folded in by the fixer (fixer-relayed, comment verified by me; the code
claims are ITS measurements):
- **(c) mangling must be a DISTINCT existential-box opcode**, NOT identical to the interface.
- **(d) do NOT treat `dyn IFoo`/`IFoo` "compatibly"** — a value has `ExistentialType`, never interface
  type.
- **The constraint-supertype path shouldn't coerce the interface at all** — Tim reads the build-blocking
  "exemption" as a likely underlying bug in **default-arg-value checking for a generic type param with a
  default but no constraints** (`<T = float4>`); the fixer says its pushed code already uses the
  resolved constraint type (no "exemption").
⇒ **Now a real multi-file implementation, multi-hour.** Fixer launched a read-only survey subagent
(classify all interface-type sites) → implement a–f + open-existential conversions → rebuild → full
suites → `slang-reviewer` → post updated triage. Worktree clean at `b9a9b60e`, master fetched
`d70456f3`. Fixer checkpoints at survey-complete and build-green.

## Build-10 checkpoint — 08-17 23:36Z (fixer-measured; suite counts are ITS re-measure, not mine)

Build 10 green. **Serial re-measure: dynamic-dispatch 696/696, interfaces 75/75, generics 251/251 —
all 100%** (the `Ptr<T>` inference regression from build-7's too-aggressive `TryUnifyTypes` unwrap is
fixed — refined to skip the unwrap when the counterpart is a solvable type param, so `T` binds to the
box). **Autodiff: 8 files (autodiff-through-`dyn IFoo`) SIGSEGV deterministically in isolation** at
`-target cpp` codegen; front-end clean.
⚠️**Fixer HONESTY CORRECTION — it had UNDER-COUNTED these: its failure grep matched `CHECK`/
signature-mismatch strings but not `SIGSEGV|server killed`, so the crashes were filtered out of the
count.** Earlier "2 signature files" → actually **8 hard crashes**; the 97% aggregate was right, the
characterization wrong. That's the filter-must-catch-every-signature trap →
[[feedback_a_watcher_scoped_to_the_known_hazard_reports_silence_as_all_clear]] (added as its 4th form).
Also this round: **reverted** the build-8 autodiff derivative-signature edit (didn't fix
`dynamic-dispatch-material`, *introduced* an autodiff SIGSEGV storm) — the autodiff-diff-through-
existential cluster will be **reported to Tim as a confounding case, not force-fixed** ("don't force it").

⛔**NOT YET ESTABLISHED — regression vs. pre-existing for the 8 SIGSEGVs.** Fixer's hypothesis is
*pre-existing-but-newly-reachable* (its type-layout-assert fix removed a wall that may have masked the
codegen crash), but it is correctly **refusing to claim that without a baseline** — stashing Phase-3,
building committed Phase-2 head `b9a9b60e`, running those 8. If it's a true Phase-3 regression it
bisects/reverts. **Do not record the pre-existing framing as fact until the baseline lands.**

## ✅ SYSTEMATIC PASS COMMITTED + PUSHED — 08-18 00:14Z (✅ = verified by me)

Head **`9721410a37`** (`fix/issue-12430`) ✅. **Commit is CLEAN** — no `Co-Authored-By: Claude` (fixer
amended + force-pushed with lease to strip it; upstream forbids AI attribution) ✅.
⭐**Diff-size numbers — BOTH true, don't confuse them (verified):** fixer reported "+267/−38, 17 files"
= the **Phase-3 INCREMENT** (`b9a9b60e...9721410a`), which I confirmed exactly. The **PR-vs-master
CUMULATIVE** is **+463/−51, 26 files**. The increment is the honest "what this push changed" figure.
`9721410a` is `ahead=1, behind=0` of `b9a9b60e` ✅ — so the "built the committed base and reproduced"
baseline lineage is sound.

⭐**The 8 autodiff SIGSEGVs are PROVEN PRE-EXISTING** (fixer built committed base `b9a9b60e` and
reproduced all 8 identically) — last turn I held this as unestablished; now established. **Core suites
100%** (dynamic-dispatch 696/696, interfaces 75/75, generics 251/251, serial final binary); autodiff
878/900 (97%), the 22 sub-failures = the deferred autodiff-diff-through-`dyn IFoo` codegen-crash
cluster, **not force-fixed** (forcing it destabilized other green autodiff tests). Honest caveat the
fixer will surface to Tim: `existential-specialized-1` flips 1/4→0/4 (one HLSL-emit sub-test of an
already-broken file) — same deferred cluster. Reverted the (f) differential-type change as **pure
cost** (enabled 0 tests, cost that 1 sub-test).
✅**CI on `9721410a` is cosmetic — re-verified by me on the NEW head** (not carried from the prior
one): 29/30 checks `skipped`, sole non-skip `check-ci: failure` (priority-yield on a `workflow_dispatch`
draft run). Retry helper handles the yield; real signal comes on yield-clear or ready-flip.

**RESUME:** `slang-reviewer`'s verdict (~20-30 min; it re-runs on this synchronize, verdict was held for
exactly this push) → fixer posts consolidated results to Tim on #12555 (peer-review-before-report) →
handles CI webhook. **Maintainer-steered multi-step refactor** — Main records + reports up; fixer owns
the PR/maintainer edge, no re-dispatch. ⚠️Standing ops item unchanged: `clang-format-17` still not
installed (poison `packages_apt` entry, escalated to dashboard) — fixer couldn't run C++ formatting
locally, relying on CI's format check. See [[feedback_versioned_clang_format_needs_llvm_apt_source]].
