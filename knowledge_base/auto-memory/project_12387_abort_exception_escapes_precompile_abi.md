---
name: project_12387_abort_exception_escapes_precompile_abi
description: "slang#12387 — AbortCompilationException escapes precompileForTarget through the SLANG_NO_THROW public C ABI. Bot-filed + self-labelled 2026-08-06 07:22Z. Every leg verified by me at 9eb90c50a; 4 corrections/additions the body lacks (dead return at slang-emit.cpp:3450, 7 workflows not 5, census total 15 not 13, getPrecompiledTargetCode is NOT exposed). Routed to slang-triager. RESUME: any non-bot comment, or #12382 merging."
metadata: 
  node_type: memory
  type: project
  originSessionId: ea332bcd-206b-4759-aa34-fd53b7063c73
---

# slang#12387 — `AbortCompilationException` escapes `precompileForTarget`'s `SLANG_NO_THROW` ABI

Filed 2026-08-06 07:22:52Z by `nv-slang-bot[bot]` — a **sibling session** spun this out of the #12385
chain, announced on #12385 as cmt **5201650926** (07:23:12Z). OPEN, **0 comments** (re-checked at
dispatch, 07:3xZ), no assignee. Labels `Diagnostics` + `spirv_validation` + `reproduced`, all three
applied by the bot identity at 07:33:27–07:33:55Z. Fourth artifact of the #12371 family.

## Verified independently at `9eb90c50a` — the core claim holds at every leg

The full throw path, each hop read:

1. `Module::precompileForTarget` at `slang-compiler-tu.cpp:91` calls
   `codeGenContext.emitPrecompiledDownstreamIR` (`:186`).
2. Validation gate: `shouldRunSPIRVValidation` (`slang-emit.cpp:3264-3284`) returns true from
   `SLANG_RUN_SPIRV_VALIDATION=1` alone. It reads
   `codeGenContext->getTargetProgram()->getOptionSet()` — **the same object `precompileForTarget`
   populates**, so the public-API path does reach it.
3. `diagnose(Diagnostics::SpirvValidationFailed{})` (`slang-emit.cpp:3449`) →
   `diagnoseRichImpl` → `if (effectiveSeverity >= Severity::Fatal) SLANG_ABORT_COMPILATION`
   (`slang-diagnostic-sink.cpp:696-699`) → `handleSignal(SignalType::AbortCompilation)`
   (`slang-signal.h:38-39`) → `throw AbortCompilationException` (`slang-signal.cpp:170`).
4. ✅ **No frame between the throw and the ABI catches anything.** `grep -c 'catch ('` → **0** on all
   of `slang-emit.cpp`, `slang-code-gen.cpp`, `slang-compiler-tu.cpp`. (`slang-emit-spirv.cpp`'s 2
   `catch` hits are both the phrase *"catch-all"* in comments — not clauses.)
5. `SLANG_NO_THROW` on the declaration at `include/slang.h:5694` (verified by line number), and the
   macro is `__declspec(nothrow)` only under `SLANG_WINDOWS_FAMILY && !defined(SLANG_DISABLE_EXCEPTIONS)`
   (`:206-210`), empty otherwise (`:211-213`). The body states this asymmetry correctly.
6. `Module` really does hand out this interface: `slang-module.cpp:35-36` returns
   `IModulePrecompileService_Experimental*` from `queryInterface`, so the repro's `queryInterface`
   step is sound.

⛔ **I did not execute the repro** — it needs a compiled host program, and my build tree's generated
diagnostics (`build/.../slang-rich-diagnostics.cpp.fiddle`, Aug 4 07:30) **predates** `9cd92bb3a`
(Aug 6 01:55), which is the commit that introduced `SpirvValidationUnavailable`. That stale artifact
was still a valid instrument for reading `SpirvValidationFailed`'s severity (unchanged since
`0864e60e6`), but it is **not** a valid binary for running the repro. The chain is source-verified,
not execution-verified — say so.

## Four things the body does not carry

1. ⛔⭐⭐ **The `return SLANG_FAIL` at `slang-emit.cpp:3450` is DEAD CODE, and its own comment claims
   the opposite.** `spirv-validation-failed` is declared `internal(...)`
   (`slang-diagnostics.lua:5922`) ⇒ `Severity::Internal`, which is the **highest** enum member
   (`slang-diagnostic-sink.h:13-21`) and therefore satisfies `>= Fatal` — so `diagnose()` throws and
   line 3450 is never reached. The comment at `:3446-3447` says *"Whether a rejected module reaches
   the caller must not depend on the diagnostic's severity, so fail here rather than leaving it to
   the sink's abort"* — which is exactly what does **not** happen. Its sibling arm proves the
   discriminator: `SpirvValidationUnavailable` is `err(...)` (`:256-261`) ⇒ `Severity::Error` ⇒ its
   identical `return SLANG_FAIL` (`:3442`) **is** live. Both the dead return and the false comment
   came in with `9cd92bb3a` (#12353). ⇒ **This gives a maintainer a second candidate fix the issue
   never names: reclassifying the diagnostic `internal` → `err` makes the existing return live.** No
   severity override rescues it (`getEffectiveMessageSeverity` refuses to lower `Error`-or-above,
   `slang-diagnostic-sink.cpp:744-747`). Mechanism:
   [[feedback_a_return_after_diagnose_is_dead_if_the_severity_aborts]].
2. ⛔ **"five CI workflows" is wrong — it is 7 files, but only 6 set the variable and only 5 are
   real CI arms.** `grep -rln` → 7: `ci-slang-coverage-test.yml`, `ci-slang-sanitizer.yml`,
   `ci-slang-test-container.yml`, `ci-slang-test.yml`, `nightly-remix-test.yml`,
   `nightly-slang-test.yml`, **`claude-ci-analysis.yml`**. The last is a **prose mention inside a
   prompt** (`:243`, *"Set `SLANG_RUN_SPIRV_VALIDATION=1` to reproduce locally"*) — not an export.
   ⇒ The defensible figure is **6 workflow files export it** (11 export/env lines total). The
   direction of the error favors the issue (exposure is wider than claimed), which is why it is worth
   correcting rather than dropping.
3. ⛔ **The census total is 15 clauses, not 13 — and the 2 extra are the most interesting ones.**
   `grep -rn 'catch *( *const *\(Slang::\)\?AbortCompilationException' source/` → **15**. The body's
   13 are all in `source/slang/`; it misses `slang-diagnostic-sink.cpp:970` and `:984`, which sit
   **inside `outputExceptionDiagnostic` itself** — the very helper the suggested fix calls. They exist
   because `diagnoseRaw(Severity::Internal|Fatal, …)` *itself* throws, and their comments say
   *"prevent exception leak from loadModule"* — i.e. **the fix helper is already hardened against the
   same defect**, which strengthens the suggested fix rather than weakening it. ⇒ Report the census as
   **15 = 8 convert + 5 rethrow + 2 self-guard**.
   ✅ The 8/5 convert/rethrow split itself I verified body-by-body; it is correct. Method:
   [[feedback_a_catch_site_census_must_split_convert_from_rethrow]].
   ⚠️ One nuance in the convert row: `slang-session.cpp:1427` does **not** call
   `outputExceptionDiagnostic` — it sets `module = nullptr` and falls through to
   `_diagnoseErrorInImportedModule` (`:1434-1440`). Still a convert, different mechanism.
   `slang-end-to-end-request.cpp:1927` likewise converts by diagnosing only `if (errorCount == 0)`.
4. ⛔ **`getPrecompiledTargetCode` — the body's "worth checking" — is NOT exposed. I checked; it is
   clean.** Both overloads are pure IR-walk + blob copy with no `diagnose()` and no downstream call:
   `Module::` at `slang-compiler-tu.cpp:235-257` (iterates `IREmbeddedDownstreamIR` children, returns
   `SLANG_FAIL` if absent), `ComponentType::` at `:285-293` (`SLANG_UNUSED` ×3, `return SLANG_FAIL`).
   ⇒ Answering the open question in the issue: **no**. Also note `ComponentType::precompileForTarget`
   (`:278-283`) is an unconditional `return SLANG_FAIL` stub — the defect is `Module::`-only.

## Triaged + POSTED by slang-triager 08:46:43Z — cmt 5202431980, and it beat my caution

`slang-triager` returned a 199-line memo (`triage-12387.md`) and posted **cmt 5202431980** — verified
live by me: author `nv-slang-bot[bot]`, 7808 chars, **`created == updated`** (never edited), comment
census 0→1, zero HTML-escaping, 11/11 load-bearing fragments I probed present, zero-control 0.
Classification bug / **high** / P2 / compiler-core. All four of my findings re-derived and held.

**⭐ It executed what I could only source-verify, and did the freshness check the right way.** My hold
was on a stale generated-diagnostics tree; it established its `libslang.so` **behaviourally** —
must-hit control (#12353's diagnostic string present) + must-miss control — rather than assuming, then
built a host: 3 cells, both controls passing, `[probe] RETURNED normally` never printing in cell 1,
dynamic type confirmed via `abi::__cxa_current_exception_type()`. Published scope is exactly
*"source reviewed at `9eb90c50a`; binary behaviourally postdates `9cd92bb3a`"*. ⭐ **That is the
correct way to rescue a stale-instrument hold: probe the instrument for the property you need, don't
assert freshness from a timestamp.**

**⭐⭐ The finding that outranks everything either of us had — a SECOND trigger with no validation
involved.** A nested `ParameterBlock<MaterialSystem>` inside `ParameterBlock<Scene>` makes
`precompileForTarget` escape with **`Slang::InternalError`**, **env var unset**, thrown by
`SLANG_UNIMPLEMENTED_X` at `slang-emit-spirv.cpp:3017` during *emission* — **before**
`shouldRunSPIRVValidation` is ever consulted. ✅ Verified by me at source: `:3015-3017` is the
`Unhandled global inst in spirv-emit` fallthrough; `SLANG_UNIMPLEMENTED_X` →
`handleSignal(SignalType::Unimplemented)` (`slang-signal.h:29`) → `throw InternalError`
(`slang-signal.cpp:172-173`, the `default:` arm); `InternalError : Exception`
(`slang-exception.h:63`), and **neither** exception type derives from `std::exception`.
⇒ **Fixing #12385 removes the reported trigger and leaves the defect standing.** Correctly scoped in
the memo as *two demonstrated triggers*, **not** a universal quantifier over all `Severity >= Fatal`
sites.

⛔ **This also kills a workaround I would have offered.** `skipSPIRVValidation = true` does **not**
rescue trigger 2 (measured with the env var both set and unset). There is **one** workaround — a host
`catch (...)` — of unverified portability where `SLANG_NO_THROW` really is `__declspec(nothrow)`.

**Two more findings, both verified by me:**

- **C11 — a sibling facade already carries the converting guard.**
  `TargetProgram::getOrCreateEntryPointResult` has a live `catch (const Exception&)` → `diagnose` →
  `return nullptr` at `slang-target-program.cpp:148-154`, while its sibling
  `getOrCreateWholeProgramResult` (`:98-117`) has **none**. Precompile uses neither:
  `precompileForTarget` (`slang-compiler-tu.cpp:186`) → `emitPrecompiledDownstreamIR`
  (`slang-code-gen.cpp:172-175`) → `_emitEntryPoints`, straight to code-gen. ⇒ Fix shape is
  **copy/hoist the guard, not route through the accessor** — the accessor compiles ONE indexed entry
  point and caches it, while precompile marks arbitrary module functions as exports, and it breaks for
  a module with no entry points (`hasAtLeastOneFunction`, `:161-176`). Guarded-accessor callers are
  only `slang-linkable.cpp:258/:316/:342/:536/:575/:753` — verified, none on the precompile path.
- **C12 — the CLI converts the *same* emitted `InternalError` on the same binary** (`error[E99997]`,
  exit 255, clean). ✅ Attribution verified: `slangc`'s own guard (`slangc/main.cpp:36-54`) is
  `#ifndef _DEBUG` and this build defines `_DEBUG` ⇒ compiled **out** ⇒ recovery comes from the
  three-arm guard at `slang-end-to-end-request.cpp:1922-1958`, whose diagnostic
  `compilation-aborted-due-to-exception` is `err(...)` code 99997 (`slang-diagnostics.lua:5909-5913`)
  ⇒ `Severity::Error` ⇒ **cannot re-abort**. ⭐ **That is the fix template with a known-safe severity.**
  Correctly scoped: that guard is compiled out under `SLANG_DEBUG_INTERNAL_ERROR` (sole use,
  `:1911`), not defined here.

⚠️ **One figure of the memo's needs a scope label, and one boundary is missing from its C11 story:**
its census-scope aside (*"6 `catch (const Exception&)` + 24 `catch (...)` also can"*) is
`source/slang/`; over `source/` the same greps give **15** and **25** (extras in
`slang-record-replay/` ×8, `slangc/` ×1, `slang-glslang/` ×1). Both right, roots unstated —
[[feedback_a_census_scope_must_name_the_directory_not_just_the_predicate]]. And there is a **second**
`Exception`-guarded convert boundary in `slang-linkable.cpp`: `ComponentType::getTargetArtifact`
(`:685`) wraps `getOrCreateWholeProgramResult` in `try` and converts at `:766-779`, populating
`outDiagnostics` only `if (outDiagnostics && !*outDiagnostics)`. ⇒ So the whole-program accessor **is**
guarded, one frame up, by its only two callers' facade — which *strengthens* the memo's
"copy the guard" recommendation (it is the established pattern at 6 boundaries in `source/slang/`,
not 5) without changing it.

## Public footprint — was ZERO on #12387 before the triage post

⚠️ **Re-checked at the moment of dispatch, not carried forward** (0 comments, 07:3xZ). The
announcement lives on **#12385** (cmt 5201650926), not here. Under the shared `nv-slang-bot[bot]`
identity a sibling may post at any time — re-query before asserting a census.
Mechanism: [[feedback_a_shared_bot_identity_makes_a_footprint_census_stale_on_arrival]].

The issue is well-formed and self-labelled, so the gap is not triage-metadata — it is that findings
1–4 above are absent from the public trail. Routed to `slang-triager` on
`thread_id=gh-issue-shader-slang/slang-12387`; posting is triager's call (closest-to-the-state).
Direct edges only — `slang-fixer` is triager's child, not mine.

## Sequencing

Unlike #12385, **this fix has no dependency on PR #12382** (still **draft**, head
`f93eb4f74`): the boundary guard is orthogonal to which buffer gets validated. #12382 *does* touch the
same `if (needsValidation)` block (+11/−5 in `slang-emit.cpp`, moving validation onto the linked
artifact) but changes neither diagnostic's severity — so **finding 1's dead return survives #12382
unchanged**, and the two can land in either order.

## Comment PATCHED in place 08:56:42Z — verified, with one residual defect that is MINE

Triager patched cmt 5202431980 rather than stacking: len **7808 → 8975**, `created` 08:46:43Z /
`updated` 08:56:42Z, **comments still 1**. ✅ Verified live by me. It added my sixth boundary as the
Approach-A precedent (correctly, and stronger than I stated) and labelled the census aperture. It also
checked whether its *published* text carried the wrong "has none" framing before acting — it did not;
the error was memo-only. ⭐ **Checking blast radius before correcting, and finding the error never
went public, is the right order** — most of the value of that check is that it prevents a needless
public edit.

⛔ **But the patched extras enumeration is wrong, and the defect traces to the discriminator I handed
over.** I gave `grep -rl … | cut -d/ -f2 | sort | uniq -c` to reconcile a **clause** census — and `-l`
counts **files**. The published breakdown reads *"extras being in `slang-record-replay/` (2 and 0),
`slangc/` (1 and 0), `slang-glslang/` (0 and 1), plus 6 more `catch (const Exception&)` outside
`source/slang/`"*. Measured in clause units: `source/slang/` **6**, `slang-record-replay/` **8**
(in 2 files), `slangc/` **1** ⇒ `6 + 8 + 1 = 15`, no residual. The published "plus 6 more" **is** the
file-vs-clause delta (8 clauses − 2 files). The `catch (...)` row closes correctly **by luck**
(`slang-glslang/` holds 1 clause in 1 file), which is what let the mismatched row look like a mere
gap-to-be-named. Full mechanism: [[feedback_a_reconciling_instrument_must_report_the_censused_unit]].
⇒ **Cosmetic on the public record** (the two headline totals, 15 and 25, are right; only the
per-directory split and residual are), so **not worth a second edit** to a maintainer-facing comment —
but the correct clause-unit form is `grep -rn` in place of `grep -rl`, and that is what to hand over
next time.

## DRAFT PR OPEN — #12552, verified live 2026-08-14 22:4xZ

`slang-fixer` reported a [Fix Report] **directly to me** (msg 34), not up through `slang-triager` (its
dispatcher on this chain) — a topology skip; I replied on the fixer's own edge (`in_reply_to=34`,
canonical thread), which is a peer-reply to an existing session, **not** a fresh Main→fixer dispatch,
so it mints no phantom (distinct from anchor H's failure mode).

✅ **Verified against the live artifact, not relayed** (`github_get_pull_request` #12552): real, **draft**,
`state=open`, base `master`, head `fix/issue-12387`, author `nv-slang-bot[bot]`, label `pr: non-breaking`,
reviewer `saipraveenb25`, `Fixes #12387` in body. Scope matches the authorization exactly — 3 files:
(1) three-arm boundary guard in `slang-compiler-tu.cpp` mirroring `ComponentType::link`
(`AbortCompilationException` / `Exception` / `...` → `outputExceptionDiagnostic` + `SLANG_FAIL`);
(2) **comment-only** fix in `slang-emit.cpp:3462` (the dead-return comment; severity **NOT** changed —
B correctly excluded); (3) new no-GPU `unit-test-precompile-exception-boundary.cpp` using the
nested-`ParameterBlock` `InternalError`-during-emission trigger (survives #12385). The PR body's
Process report is well-formed and answers the input-shape check (input is a legitimate module; guard
belongs at the ABI boundary, not upstream). Fixer's own test claims (1/1 new, 578/578 suite, must-fail
control) and CI characterization ("only check-ci + wait-for-human-priority; 83 jobs skipped = cosmetic
draft priority-yield") are **the fixer's, un-recertified by me** — draft CI skipping is expected; the
reviewer / CI-babysitter own real CI.

## MAINTAINER APPROVED + both obligations closed — verified live 2026-08-14 23:1xZ

✅ **Approval is real, not relayed** (`github_get_pull_request_reviews` #12552): review **4941844655**,
`state=APPROVED`, user `tangent-vector` (the same maintainer who authorized the PR), submitted
23:15:53Z, **empty body** = clean approve, no inline comments. ⚠️ Note it is an approve **on a draft** —
the PR still needs a human ready-flip (auto-assigns CODEOWNERS) and merge; an approval does not flip or
merge it. Fixer is holding correctly; `slang-reviewer`'s 3-reviewer pipeline still running (~20-30m),
to be folded in.

✅ **Both obligations I flagged were closed by the fixer, verified independently:** (1) footprint =
`nv-slang-bot[bot]` cmt **5298936909** on #12387 at 22:51:39Z — the exact draft-held 5-bullet (verdict
"fix in draft PR #12552, held pending reviewer + human ready-flip"), issue now at 3 comments; (2)
`report_pr_created` done (fixer says hook confirmed the mapping — container-side, not independently
checkable by me, but the footprint half checks out and the claim is consistent). My msg-34 flag was
correct when I read the issue (comments_count=2) and either prompted or crossed the fixer's post — the
flag worked as intended; nothing to walk back, nothing content-free to send back.

## (superseded) TWO obligations flagged open on msg 34 — now CLOSED:
1. **Draft-held footprint [MUST].** Issue #12387 has **0** bot comments since the draft opened — a
   human sees Tim Foley's *"craft a PR"* (cmt 5296388896) then nothing. My rule: a draft's `Fixes #N`
   is **not** a substitute (doesn't auto-close, doesn't surface prominently). The tier that opened the
   PR posts the 5-bullet on the **issue** (verdict = "fix in draft PR #12552, held pending reviewer +
   human ready-flip").
2. **`report_pr_created({repo, pr:12552})`** — not mentioned in the report; without it, follow-up
   review webhooks may fall through branch-resolution instead of routing to the fixer's session. Fixer
   must call it (container-side; I cannot write `pr_session_mappings`).

## NON-DRAFT + APPROVED, human-gated on merge — verified live 2026-08-15 06:0xZ

✅ **PR #12552 is now non-draft** (`github_get_pull_request`: `draft=false`, `state=open`,
`merged_at=null`, `closed_at=null`, base `master`, `pr: non-breaking`, `Fixes #12387` in body,
`updated_at` 2026-08-15T00:15:50Z). Independently confirmed the state change the triager reported; I
did not re-certify its head-SHA-binds-approval claim (`1efff15f38`) or the CI 27/0 count — those are
the triager's, and not load-bearing for the chain state (non-draft + approved + open is what matters,
and I confirmed non-draft directly; the APPROVED review 4941844655 I confirmed last turn).

✅ **`report_pr_created` landed — verified via the mapping, not the fixer's word:** `ncl pr-mappings
list` shows `shader-slang/slang 12552 → ag-1780667166439-vmjrwe / sess-1786740609065-4ox004`, thread
`gh-issue-shader-slang/slang-12387`, created 22:43:00 (PR-open time). So follow-up review/CI webhooks
on #12552 route to the fixer's session, not to me. This is the fixer's group, correct owner.

**slang-reviewer's 3-reviewer pipeline: APPROVE_WITH_NITS** (triager's report), all non-blocking
comment-wording; fixer correctly did **not** push a nit-fix commit (would move the head off
`1efff15f38` and unbind tangent-vector's approval). Right call — do not disturb an approved head for
cosmetics.

⇒ **Chain terminal, human-gated. The ONLY remaining action is a maintainer rebase+merge of #12552**
(`mergeable_state=behind`); merging auto-closes #12387 via `Fixes #12387`. The non-draft PR is the
public trail, so no issue double-post — the triager sent its `[Triage Resolution]` upstream instead,
correctly. **Triager holds the merge co-trigger:** on merge it re-reads the merged diff, refreshes
verdict cmt 5202431980 in place, sends final resolution. Nothing on my edge until then — the human in
the loop is a Slang maintainer acting on GitHub, not an operator I need to ping (tangent-vector already
approved; merge is their call, already surfaced on the PR).

⚠️ Triager's own reachability gate showed 3 orphans — **its store, not mine** (per-container path; its
`triage-12387.md` reachable, the 3 are older other-chain memos it didn't create). My store confirmed
clean last turn. Not my action.

## 2026-08-15 21:58Z — fixer flags a dead a2a route; VERIFIED it's a fixer-edge bounce, NOT session death

`slang-fixer` (msg 48) reported its a2a route to triager session `sess-1786003063013-gidfh3` on thread
12387 bounced 4× "bounced-unknown / will not self-recover," re-drove once, bounced again, stopped.

⛔ **The "dead session" framing is wrong, and I corrected it rather than relaying.** `ncl sessions
list`: `sess-1786003063013-gidfh3` (ag-1780667166418-apezq5 = `slang-triager`) is **`active` /
`running`**, last-active **21:58** (= now), and is the **only** triager session on the 12387 thread —
i.e. it is the same session that replied to me through msg 46. My edge reaches it fine. ⇒ **What is
dead is the fixer→triager a2a edge specifically, not the session.** Distinct failure: a route bounce on
one wiring, not a wedged/dead recipient. ([[feedback_a_shared_identity_breaks_unanswered_as_badly_as_already_answered]]-adjacent:
the same session id means different reachability per *source edge*.)

✅ **No consequence to the chain.** Fixer confirms (and it's consistent) no content lost — its status
was already delivered to me (msg 31/34) and to the triager. Chain is human-gated on a maintainer
rebase+merge, which routes **GitHub webhook → PR#12552 mapping → fixer group** (`report_pr_created`
row verified last turn), **not** over the fixer→triager a2a edge. The triager's post-merge co-trigger
is webhook-driven by its own statement, independent of that edge. So the dead edge strands nothing
today, and the fallback is armed: **any post-merge fixer→triager handoff routes through me** (my edge
to the triager is live).

✅ **Two new facts verified, not relayed:** `github_get_pull_request_reviews` #12552 → **two** APPROVED
reviews, both `tangent-vector` (MEMBER): 4941844655 @ 2026-08-14T23:15:53Z, 4942068516 @
2026-08-15T00:15:50Z. "approved ×2" is real. PR still `draft=false`, `state=open`, `merged_at=null`.
(Did not re-run GraphQL for the `MERGEABLE`/behind enum — not load-bearing; `behind` = needs the human
rebase either way.)

⚠️ **The a2a "will not self-recover" bounce is a durable infra defect** in nanoclaw's routing (a route
persistently failing while its target session is provably alive). No content lost and nothing blocked,
so not an operator interrupt — flagged to the fixer for the record; escalate to the operator only if a
live handoff ever actually needs that edge and my relay fallback also fails.

## Fix shape — a maintainer decision, NOT dispatched

Triager's candidates, and I agree with its ranking:
**A (rec)** boundary guard on `Module::precompileForTarget` (sink already at `slang-compiler-tu.cpp:111`,
`outDiagnostics` at `:188`), adapting the CLI's three-arm shape — fixes **both** triggers and any
future one, no severity change. Note the adaptation: the CLI's `AbortCompilationException` arm
diagnoses only `if (errorCount == 0)` (`:1932-1939`), so a `SlangResult`-returning guard must populate
`outDiagnostics` in **every** arm. **B** reclassify `spirv-validation-failed` `internal`→`err`, making
`:3450` live — fixes one diagnostic only, leaves trigger 2, and is a public-behaviour change. **C**
both. **D rejected** — route through the guarded accessor (semantics differ, breaks entry-point-less
modules).

⛔ **No fixer dispatched, deliberately.** The choice between the boundary guard and the severity
reclassification is a maintainer's call, and nothing here is blocked waiting on us.

⭐ **CHAIN STATE 2026-08-14: draft PR #12552 maintainer-APPROVED (review 4941844655, tangent-vector, 23:15Z), held for human ready-flip; slang-reviewer 3-reviewer pipeline pending. RESUME FIRED 2026-08-06 (cmt 5296388896, `tangent-vector` = Tim Foley, Slang lead):** *"The fix
here seems straightforward, as you say: apply the idiom already in use elsewhere on the public API
boundary. Craft a PR with a fix."* ⇒ This is **Approach A explicitly** — "the idiom already in use
elsewhere on the public API boundary" is the boundary guard copying the existing convert-sites, NOT
the severity reclassification (B). A maintainer authorizing a PR is a genuine `@nv-slang-bot` mention
⇒ GitHub PR creation authorized. **Routed to `slang-triager` on the canonical thread** (anchor H:
triager owns the fixer edge; I do NOT dispatch the fixer directly). Triager to release `slang-fixer`
per its own resume plan below.

RESUME (was): any non-bot comment on #12387, or #12382 merging (both arrive by webhook; no guard armed).
On *"make a PR"* ⇒ release `slang-fixer` for a **draft** PR, **Approach A only** (do not bundle B),
`pr: non-breaking`, `Fixes #12387`; the regression test is buildable without a GPU via the host-probe
technique, and the nested-`ParameterBlock` cell is the one that **survives #12385 being fixed**.
⚠️ `extras/formatting.sh` cannot run in either of our containers (gersemi/clang-format/prettier/shfmt
absent) — the PR author must run it.

Family: [[project_12371_spirv_prelink_validation_buffer]] (parent),
[[project_12385_precompile_validation_gate]] + [[project_12385_spirv_validation_precompile_overfire]]
(the trigger; its leaves already flag this ABI hole as a separate defect),
[[project_12383_spirv_validation_before_spvopt_strip]] (sibling).
