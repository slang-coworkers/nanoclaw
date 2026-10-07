---
type: project
name: project_13461_generic_extension_witness_join_stack_overflow
description: "slang#13461 (rkoivunen-sw TLA+ batch, 10-06): the reported 'unbounded backtracking' doesn't exist (the solver is a forward work-list). A REAL stack overflow nearby, `extension<T> T : IRec<T> where T : IOther<T>` + `struct Z : IOther<Z>`, is a regression from #11210 (79ac457f0), first shipped in v2026.9.2. Fix: draft PR #13468 (converged 58bde2efca, waiting on the operator to un-draft). Side issues filed: #13464, #13469, #13470."
---

# slang#13461: blanket-extension witness join recurses without bound

**Filed 2026-10-06 18:17Z by rkoivunen-sw.** It's one of a batch of TLA+-model reports from this author, alongside
#13455 (mutex priority inversion) and #13462 (fillRequirements cycle, refuted). The model files are on the author's
machine and can't be checked. I routed it to slang-triager on `gh-issue-shader-slang/slang-13461`.

**Triager verdict** (posted as [6024234520](https://github.com/shader-slang/slang/issues/13461#issuecomment-6024234520);
labels `regression` + `reproduced`, Type=Bug):
- **The reported mechanism is refuted.** `GenericArgumentSolver` is a forward work-list fixpoint (`runWorkList`,
  `slang-check-constraint.cpp:1454`), so there's no backtracking. The issue's trigger `where U == T` compiles. A
  depth cap on `GenericInferenceContext` would never fire, because each nested solve gets a fresh context.
- **Real bug:** the repro below segfaults with exit 139 on every target. The cause is a re-entry loop:
  `applyExtensionToType` → witness `T : IOther<T>` → `TryJoinTypes` (symmetric, swaps at `:404`) →
  `isSubtype(IOther<IOther<Z>>, IOther<Z>)`, which asks for the inheritance of a strictly larger type. A second
  path goes through `cacheSubtypeWitness` (`slang-check-inheritance.cpp:120`). Every level is a new type, so the
  identity-keyed guards never fire.
- **Prototype fix** (needs both legs): (1) a one-directional join when `sup` is an interface; (2) don't compute
  the super type's inheritance while the sub type is still in progress.
- **Separate and pre-existing:** `extension<X> Wrap<X> : IOther where Wrap<Wrap<X>> : IOther` overflows back to
  2025.1. That search really is non-terminating, so a budget with an E39997-style diagnostic is the right fix
  there. It's a follow-up.

```slang
interface IRec<X> {}
interface IOther<X> {}
extension<T> T : IRec<T> where T : IOther<T> {}
struct Z : IOther<Z> {}
[numthreads(1,1,1)] void main() {}
```

**My checks:**
- The repro reproduces on my own Release build (c8e02397a7): rc=139. The `IOther<int>` control gives rc=0.
- `79ac457f0` is #11210, "Consolidate generic constraint solving in a monolithic worklist".
- `b6ca5682d` is its parent.
- ⚠️ **Release range correction:** `79ac457f0` is in **v2026.9.2** (4th of 65 commits since v2026.9.1). It is not
  in v2026.9 or v2026.9.1. The triager's "2026.9 OK, 2026.10+ crash" never tested 9.1/9.2, and the posted comment
  says "v2026.9 compiles; v2026.10 through master crash". The first affected release is 9.2. The comment isn't
  wrong, just incomplete; the fixer's PR description should name 9.2.

**Side finding, filed as [#13464](https://github.com/shader-slang/slang/issues/13464)** (2026-10-06 20:21Z, on my
order, after I reproduced it at c8e02397a7). `int g<each T, each U>(expand each T a) where U == T` called as
`g(1, 2.0f)` compiles with countof(U)=0, and `sink<expand each U>(expand each a)` silently drops the arguments.
- It's also a regression from #11210, first in v2026.9.2; v2026.9.1 rejects it with E39999. #11210 starts every
  omitted pack as empty (`constraint.cpp:1304-1320`), which exposes two older rules: the `isSubtype`
  ConcreteTypePack branch (`conformance.cpp:379-386`, #10500) and `isTypeEqualityWitness` (`ast-val.h:1366`, #4986).
- No fixer is assigned. It is parked on two maintainer questions: which layer owns the arity check, and whether to
  reject `g(1, 2.0f)` or infer `U`.
- Resume gate `i13464-maintainer-gate-e9ef` (12h cron; now also covers #13469/#13470, script `gates/i13464-maintainer-gate.sh`) fires on a close, a
  non-bot comment, or STALE after 2026-10-13T20:00Z. I tested it on these controls: a human reply (13455),
  a closed issue (12457), and an issue with bot-only comments (13461 → false).

**State 2026-10-06 19:53Z:** slang-fixer claimed it (`sess-1791316337167-9be19a`, worktree from master
`20092570c9`). It was given GO for a draft PR `Fixes #13461` with these conditions: justify or replace both
legs at the producer layer, red-on-master tests, run the full suite, and leave the budget for later. The
triager owns the issue side and reports the PR number.

**PR opened 2026-10-06 23:29Z: draft [#13468](https://github.com/shader-slang/slang/pull/13468)**, branch
`fix/issue-13461`, head `4571b12664`. One nv-slang-bot commit with no Claude trailer, label `pr: non-breaking`,
closes #13461, 6 files +331/−3: `slang-check-constraint.cpp`, `slang-check-inheritance.cpp`, plus 4 tests (3 of
them crash on master). I checked all of this live.
- Leg A was narrowed: witness shape inference is skipped for an interface-typed subject, and the witness proof
  still decides the constraint.
- Leg B is unchanged: `cacheSubtypeWitness` returns before touching the super type while the sub type is
  mid-computation.
- Full local suite 7514/7515; `gfx-smoke` fails on master too.
- The PR body says "First affected release: v2026.9.2 (last good: v2026.9.1)". The fixer posted a new issue
  comment, 6027337009, instead of editing 6024234520.
- CI skipped: the draft gate gave 4 pass / 56 skipping. Next: the slang-reviewer pass, then the fixer's
  [Fix Report]. Flipping draft→ready needs the operator, and both approvers are paused.

**More side findings, filed 2026-10-07 00:04Z** (I reproduced both at c8e02397a7 before ordering them filed; both
verified live: nv-slang-bot, Type=Bug, `reproduced`, 0 comments; no fixer):
- [#13469](https://github.com/shader-slang/slang/issues/13469): `f<IDer>(d)` with `where T : IBase` gives ICE
  E99997 instead of E33180. Long-standing; the failure mode varies by release, and v2026.9.1 segfaults, so it's
  not from #11210. Related to #12430 and draft #12555. Thread `…/slang-13461/ice-interface-arg`.
- [#13470](https://github.com/shader-slang/slang/issues/13470): y4 `extension<X> Wrap<X> : IOther where
  Wrap<Wrap<X>> : IOther` gives rc=139 on every release since v2024.14. Proposed fix: an
  `InheritanceCircularityInfo` budget with an E39997-style diagnostic. It's #13468's follow-up; the fixer was
  asked to edit the PR body to say "tracked in #13470". At 00:05Z the body still had the old line. Thread
  `…/slang-13461/y4-budget`.
- The gate `i13464-maintainer-gate-e9ef` now covers #13464, #13469 and #13470. The script loops over them, and
  the first issue with an event wins. STALE fires once after 2026-10-13T20:00Z.

**Converged 2026-10-07 01:38Z** at head `58bde2efca`, verified live: 3 nv-slang-bot commits, 7 files
+422/−3, still a draft, 0 GitHub reviews, 3 ahead / 2 behind master. The body says "tracked in #13470".
- slang-reviewer gave APPROVE_WITH_NITS, 0 bugs. Devin timed out twice.
- The nit commits `cc4624aa66` and `58bde2efca`: I read the `4571b12664..58bde2efca` source diff. Comments only,
  plus renaming `isConcreteEquality` to `isEqualityToNonInterfaceType` (same logic) and a doc comment on
  `_getInheritanceInfoCacheGeneration`. The rest is tests.
- CI run 37557512981 is `waiting` (wait-for-human-priority).
- The triager edited issue comment 6027337009 in place (481 chars). It posts again only on merge or a human comment.
- Waiting on the operator's call on un-drafting. Re-chase task: `chase-13468-ready-1173` (2026-10-07 13:30Z).

Related: [[project_13433_interface_static_const_witness_null_crash]] (another regression from the same solver/witness area).
