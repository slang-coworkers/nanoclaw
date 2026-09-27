---
name: project_12430_pr12555_existentialtype_saga
description: "Draft PR #12555 — AST-level ExistentialType (`dyn IV`) for slang#12430, tangent-vector-authorized and steered. Forms `dyn IFoo` in every proper-type context; Repro 2 rejected via existing E38029; serialization v1→v2 + version gate; Flag-1 reflection regression fixed. Head e63deb8d07 (verified 09-27, unchanged since 09-06), peer-approved, awaiting Tim's mark-ready. Parked follow-ups listed."
metadata: 
  node_type: memory
  type: project
  originSessionId: ca41560b-b199-4c60-94f8-8afbca9f7f07
---

# slang#12430 PR #12555 — AST-level ExistentialType (`dyn IV`)

Issue + root cause: [[project_12430_existential_static_requirement_ice]]. Owners: `slang-fixer`
(PR + maintainer edge, branch `fix/issue-12430`, mapped for webhook routing), `slang-reviewer`.
Main records and reports; it does not re-dispatch.

**State (verified 2026-09-27):** draft, OPEN, head **`e63deb8d07`**, last update 09-06 08:17Z.
**RESUME = Tim's mark-ready webhook.** No blocker. Maintainer-steered throughout; every post was
authorized by his direct asks on the issue.

## How the scope grew — all by Tim's direction (comments verified verbatim)

1. **Spike (08-15, cmt `5299401967`).** Add `ExistentialType`, make it non-conforming to its interface,
   check it rules out Repro 2. Result: Repro 2 now emits existing **`E38029`** ("type argument 'dyn IV'
   does not conform to interface 'IV'"); no new diagnostic. Generic Repro 1 fixed; bare `IV.dzero()`
   is not (static-member-access base, not a generic arg — Tim investigates it himself). The full rule
   broke 68 base files; narrowing to constrained `T:IFoo` gave 0.
2. **Systematic rule (08-15, cmt `5300868123`).** *"`Optional<IV>` is 100% intended to semantically mean
   `Optional<dyn IV>` … properly apply that rule in ALL contexts where a proper/data type is expected
   … triage the test cases that fail."* The 68-file blast radius became the work. Chokepoint (his inline
   `3788755792`): `CoerceToProperType` / `tryCoerceToProperType` — an interface is not a proper type,
   an existential is. Triage posted (cmt `5301246170`), buckets: (a) make-existential coercion missing,
   (b) member lookup not transparent on `dyn IFoo` because `maybeOpenExistential` only matches
   `DeclRefType`→InterfaceDecl, (c) autodiff mangling ICE, (d) is/as, (e) interface conjunctions not
   formed, (f) autodiff differential types.
3. **Full refactor (08-17, cmt `5319797866`).** Survey every `DeclRefType`→`InterfaceDecl` check,
   classify interface-itself (keep) vs existential-box value (convert), implement a–f plus
   open-existential plumbing. His corrections: (c) mangling gets a distinct existential-box opcode;
   (d) never treat `dyn IFoo` and `IFoo` compatibly — a value has `ExistentialType`, never interface
   type; constraint supertypes shouldn't coerce the interface at all.
4. **Q1/Q2 answers (09-06).** Q1 autodiff `dyn IFoo` param → *"option A … avoid further scope creep"*
   (keep the current state, no IR-pass work). Q2 → increment the serialization format version; binary
   modules carry no cross-version compat guarantee, and the version exists to reject incompatible ones.

## What the PR now does (head `e63deb8d07`)

- `CoerceToProperType` forms `dyn IFoo` in every proper-type context; narrow gate removed.
- Core suites 100% (dynamic-dispatch 696/696, interfaces 76/76, generics 251/251, typeConformance
  6/6). Autodiff 878/900: the 22 failures are the autodiff-through-`dyn IFoo` codegen-crash cluster,
  **proven pre-existing** (reproduced identically on committed base `b9a9b60e`), reported to Tim as a
  confounding case, not force-fixed.
- AST serialization **v1→v2 + early version gate on both AST-first load paths**
  (`loadSerializedModuleContents` → `E00088`; `_readBuiltinModule` → `SLANG_FAIL`), rejecting a stale
  module before positional ASTNodeType tags decode. Manual cross-version test: v1 module → `E00088`,
  exit 1, no crash.
- **Flag 1 fixed** (`slang-check-type.cpp:460` regression surfaced by round-2 review):
  `getTypeFromString` boxed a name-as-interface lookup, so `findTypeByName("IFoo")` returned an unnamed
  box and `isSubType(S, IFoo)` returned false. Fixed producer-locally in `getTypeFromString`; both now
  match master; regression test in `slang-unit-test`. The consumer-side unwrap in
  `createTypeConformanceComponentType` stays — value/field/parameter positions still box, and removing
  it would re-regress them (the reviewer's own steer was incomplete here and it owned the correction).
- Reviews: `slang-reviewer` APPROVE_WITH_NITS, 0 bugs; codex APPROVE. No GitHub review posted.

## Parked follow-ups (surface if Tim pursues rollout completion)

1. At rebase onto master: add the automated serialization cross-version test (its home,
   `slang-static-unit-test`, is master-only; branch was ~50 behind).
2. Flag 2 / bucket (e): `IA & IB` boxes to `dyn IA & IB`; member calls (E30027) and passing a
   conforming value (E30019) fail. Documented spike-incomplete work.
3. Value/field/parameter-position interface reflection still yields an unnamed `dyn IFoo`
   (Kind::Interface, name=null). Only the name-resolution path was fixed.

## Lessons

- **Verify CI on the new head, not the prior one.** Every draft run here was cosmetic red: 29/30
  skipped, sole non-skip `check-ci: failure` (priority yield on `workflow_dispatch`). Use the full SHA —
  a truncated one 422s. See [[project_bot_pr_priority_yield_red_run]].
- **Increment vs cumulative diff are both true; name which.** "+267/−38, 17 files" was one push's
  increment; PR-vs-master was "+463/−51, 26 files".
- **A failure filter must match every terminal signature.** The fixer's grep matched `CHECK` mismatch
  strings but not `SIGSEGV|server killed`, under-counting 8 hard crashes as "2 signature files" →
  [[feedback_a_watcher_scoped_to_the_known_hazard_reports_silence_as_all_clear]].
- **Don't record "pre-existing" until the baseline build lands.** The fixer held that framing as a
  hypothesis until it built `b9a9b60e` and reproduced all 8.
- **A Devin flag is a verification task, not a presumed false positive.** The bounded round-2 pass found
  Flag 1, a real untracked regression, before mark-ready.
- Commits must carry no `Co-Authored-By: Claude` (upstream forbids AI attribution); the fixer amended
  and force-pushed with lease to strip it. `clang-format-17` apt install is poisoned — fixer relies on
  the CI format check ([[feedback_versioned_clang_format_needs_llvm_apt_source]]).
