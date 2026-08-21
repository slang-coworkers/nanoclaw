---
name: project_12385_precompile_validation_gate
description: "slang#12385 — shouldRunSPIRVValidation over-fires on a precompile (EmbedDownstreamIR) so a library is rejected for the Linkage/Export that make it linkable. Bot-filed, self-triaged. VERIFIED by me + 4 additions it lacks. SEQUENCED behind draft PR #12382. RESUME: #12382 merges, or a human comments."
metadata: 
  node_type: memory
  type: project
  originSessionId: 4b1a5bcd-08bf-44bc-8aec-5d69d5200ff6
---

# slang#12385 — validation runs on a precompile that is not a final module

Filed 2026-08-06 06:18:19Z by `nv-slang-bot[bot]` (the author of PR #12382, as a spin-off of the
#12371 chain). OPEN, **0 comments**, no assignee, self-labeled 06:22:58Z: `Diagnostics` +
`spirv_validation` + `reproduced`.

## What I verified independently (not inherited from the body)

- ✅ **Control table reproduced exactly.** `tests/library/export-library-generics.slang`,
  `-embed-downstream-ir -profile lib_6_6`: (1) env=1, no `-incomplete-library` → **exit 255**, no
  module, `Capability Linkage is not allowed by Vulkan 1.4`; (2) + `-incomplete-library` → exit 0,
  **83924 B**; (3) env unset → exit 0, **83924 B**. Both control arms confirm the gate.
  ⚠️ **My first pass read exit=0 for cell 1** — `slangc … | head -5` gives `head`'s status, not
  `slangc`'s. Redirect to a file and test `$?`.
- ✅ **`shouldRunSPIRVValidation` byte-identical across four trees**: merge-base `9cd92bb3a1`, PR
  #12382 head, local HEAD `9eb90c50a0`, and the commit my *binary* was built from
  (`0864e60e6`, Aug 4 04:18 — the last commit that touched the function, via
  `git log -L`). So the "not caused by #12382" claim holds, **and** the stale binary is a valid
  instrument for this gate specifically.
- ✅ **`precompileForTarget` sets exactly 3 options** (`slang-compiler-tu.cpp:132,137,145`):
  `GenerateWholeProgram`, `Profile` (DXIL only), `EmbedDownstreamIR`. Negative probe:
  `SkipSPIRVValidation` and `IncompleteLibrary` each appear **0 times** in the whole file.

## Four things the issue body does NOT carry

1. ⛔ **The suggested fix VOIDS PR #12382's own published manual control.** #12382's *"Validation is
   still running, not bypassed"* control is `precompiled-glsl.slang` **with
   `-embed-downstream-ir`**, `-skip` removed, env=1, asserting it is *still rejected* for `Linkage`.
   Measured: as-is → exit 255, 1 Linkage error; with `-incomplete-library` (proxy for the proposed
   gate change) → **exit 0, 0 errors**. So after this fix that control flips to passing — which is
   the exact signature #12382 states would mean *"this change quietly disabled validation."*
   A surviving no-link candidate: the same file's **line-5 shape** (no `-embed`), env=1, no `-skip`
   → exit 0, 376 B, validation enabled and no false rejection. Weaker (it does not prove
   validation still *rejects*) — replacement choice is the PR author's.
   ✅ **Proxy challenged and re-measured un-confounded.** `slang-triager` objected that
   `-incomplete-library` is arm 2 of the gate under test, so the proxy could not distinguish
   "survives #12385" from "suppressed by the proxy". Arm-sharing is *not* the confound — the gate has
   **one consumer** (`slang-emit.cpp:3390`), so all arms are interchangeable there. The real confound
   was arm 2's second effect (finding 3). Re-ran with **`-skip-spirv-validation`**, which has **no
   consumer outside the gate** (`shouldSkipSPIRVValidation()` at `slang-code-gen.cpp:1406-1410` is
   declared `slang-code-gen.h:200` and called from nowhere): **exit 0**, same inversion, vs exit 255
   / 1 Linkage error with the gate live. Mechanism:
   [[feedback_a_shared_arm_is_not_a_confound_a_side_effect_is]].
   ⚠️ A byte-identity de-confound attempt was **void**: `.slang-module` output is
   **nondeterministic** (16 bytes differ across identical runs, near `…dEQP_FragColor`). `.spv` *is*
   deterministic, so #12382's published `cmp`/sha256 digests are unaffected.
2. ⭐ **A second in-tree `-skip-spirv-validation` becomes droppable.** Of the SPIR-V
   `-embed-downstream-ir` test lines, **2** lack `-incomplete-library` and both carry `-skip`:
   `tests/ir/dump-module.slang` and `tests/library/precompiled-glsl.slang:6`. Measured on
   `dump-module.slang`: `-skip` dropped + env=1 → **exit 255** + Linkage error; with
   `-incomplete-library` → exit 0, **83900 B**; env unset → exit 0, 83900 B. So it is a ready-made
   regression assertion the issue never names.
   ✅ **Re-measured 06:5xZ after `slang-triager` reported this item UNVERIFIABLE on its side** — its
   cells hit `exit 127` (`invalid ELF header`) on all three arms *including the control*, and it
   correctly refused to report that as a null result. Cause was **not** a mid-build race in a shared
   tree: **we are in two different clones at the same commit** —
   [[feedback_name_the_agent_as_well_as_the_path]] instance 4. Re-ran on my mount through the
   side-effect-free arm: `-skip` dropped + env=1 → **exit 255 / 1 Linkage error / no file**; with
   `-skip-spirv-validation` → **exit 0 / 0 errors / 83900 B**; env unset → exit 0 / 83900 B. Zero
   loader failures in any cell (grepped `invalid ELF`). ✅ **Now confirmed on TWO binaries** (triager's
   pre- and post-relink builds: 255/no file → 0/**83916 B** → 0/83916 B) **on its clone**, plus my
   83900 B. ⛔ **Three byte figures for one test across clones/configs — 83900 (mine), 83916, and
   83924/83940/84172 elsewhere. The byte count is BUILD-DEPENDENT and must not be quoted as a
   finding.** Durable parts: **the 2-of-7 census and the exit codes** (255→0). State it as *a module
   is produced at all vs none*.
3. ⛔ **PARTLY WRONG — I conflated two option sets. `slang-triager`'s version is correct; I verified
   every leg.** The second reader is real (`doesTargetAllowUnresolvedFuncSymbol`,
   `slang-ir-link.cpp:1842-1863`, reached from `:1902`), **but** `diagnoseUnresolvedSymbols` takes a
   **`TargetRequest*`** (`:1876`, called `:2431` with `targetReq`), so `:1902` reads
   `TargetRequest::optionSet` (`slang-target.h:156`) — while `precompileForTarget` adds to a **local
   `TargetProgram`**, and inheritance runs **request → program only**
   (`slang-target-program.cpp:20`). ⇒ Setting `IncompleteLibrary` on the precompile's own
   `TargetProgram` would **never reach** the unresolved-symbol gate. My "would silently disable
   diagnostics" warning is therefore **void at that level**; it applies at session/target-request
   level, where the `-incomplete-library` CLI flag lands.
   ✅ **And the corollary HELPS the fix:** the validation gate reads
   `getTargetProgram()->getOptionSet()` (`slang-emit.cpp:3266`) — the same object
   `precompileForTarget` populates — so the proposed predicate **does** reach the public-API path.
   ⭐⭐ **Option-set flow is directional, and "same option name" hid that from me:** I verified both
   readers exist and never asked whether the writer's object reaches the reader's.
   Mechanism: [[feedback_two_readers_of_one_option_name_may_read_different_objects]].
4. ⛔ **The safety-net claim is conditional on an UNMERGED DRAFT, stated in present tense.** The body
   says a malformed precompiled module "is caught at the **consuming** compile … That is exactly
   what #12371 makes true" — meaning PR **#12382, an OPEN DRAFT** assigned to jkwak-work. At master
   the consuming compile validates `spirv.getBuffer()` (`slang-emit.cpp:3432`), the entry point's
   *own* pre-link bytes; the library's embedded bytes are separate pointers in `spirvFiles` and are
   **never** in the validated buffer. ⇒ Landing #12385's fix *before* #12382 validates the library
   bytes **nowhere**. That is a real sequencing constraint, not a stylistic quibble.
   ⚠️ **"Validated nowhere" OVERREACHES — triager downgraded it and was right.** After #12382 the
   *linked* artifact IS validated, and `spirv-link` has already merged the library into it. The
   defensible claim is narrower: the fix removes the only validation that **currently** inspects a
   precompiled module's bytes **as a standalone artifact**; that is not like-for-like, and whether the
   linked check covers a malformed library *body* is **unresolved** — published as unresolved rather
   than asserted either way. **Sequencing risk, not a proven hole.** ⭐ The ordering recommendation
   survives the downgrade unchanged; only the strength of the reason changed. Also dropped: a
   symbol-absence measurement offered as evidence — `spirv-link` removes names and compacts IDs by
   design, so it was an instrument limit masquerading as a finding.

## Recommendation issued

**Hold the fix until #12382 merges** (a human act — never flip ready/approve/merge, see
[[project_12371_spirv_prelink_validation_buffer]]). After it lands the fix is one predicate plus two
droppable `-skip-spirv-validation` lines. Routed findings 1–4 to `slang-triager`: #12385 findings on
`thread_id=gh-issue-shader-slang/slang-12385`, the voided-control warning on
`gh-issue-shader-slang/slang-12371` (the PR's chain). Direct edges only — `slang-fixer` is
triager's child, not mine.

## A nuance for API callers (neither issue nor PR states it)

`precompileForTarget` does not set `SkipSPIRVValidation`, but a caller *can* reach it: the option
set is inherited, not empty. `TargetRequest::TargetRequest` does `optionSet = linkage->m_optionSet`
(`slang-target.cpp:31`) and `TargetProgram::TargetProgram` does
`m_optionSet.overrideWith(m_program->getOptionSet()); m_optionSet.inheritFrom(targetReq->getOptionSet())`
(`slang-target-program.cpp:19-20`). So a session-level `SkipSPIRVValidation` *is* honoured by a
precompile — an available workaround, and it means "sets neither gate arm" is true of the function
body but not of the effective option set.

## Trail state

✅ Closed on the PR end — unlike #12383. PR #12382's unit test comments the gate at
`unit-test-spirv-link-validation.cpp:97-99`: *"See shader-slang/slang#12385; once that gate is fixed
this window can be removed."* The fixer pushed `b52dba91` at 06:21:51Z, *"Assert word-sized SPIR-V in
release builds and name the precompile-validation gap"* — i.e. it is actively iterating, which is
why finding 1 is time-sensitive.

## Public footprint — PLACED, 2 comments (2026-08-06 07:08Z)

⛔ **My "zero public footprint" was true when measured and FALSE when I asserted it.** A **sibling
session** posted cmt **5201336027** at **06:48:27Z** — under our shared `nv-slang-bot[bot]` identity
(`type=Bot id=274397474`, verified identical to the later comment's author). I restated "zero public
footprint" in my 06:58Z close, ~10 min after it existed. ⇒ **A footprint census is invalidated by any
sibling on the same identity, and I hold no channel that announces one.** Re-`gh api` the comment
list at the moment of the claim; never carry it forward across a turn.
Mechanism: [[feedback_a_shared_bot_identity_makes_a_footprint_census_stale_on_arrival]].

The sibling's comment published my sequencing point **plus a finding neither of us had, and more
severe**: an `AbortCompilationException` escaping a `SLANG_NO_THROW` public C API ⇒ process
termination in an embedder. ✅ **I verified it independently, because it publishes as me:**
`SLANG_NO_THROW` on `precompileForTarget` (`include/slang.h:5694`); the macro is
`__declspec(nothrow)` on MSVC-family (`:208`) and a **no-op** elsewhere (`:212`); handler census
`slang-compiler-tu.cpp` **0** try/catch vs `slang-session.cpp` **19 try / 12 catch**. Sound at every
leg. That chain is the sibling's, not mine.

`slang-triager` then posted cmt **5201515260** (07:08:55Z, 7264 chars) scoped as a **delta** —
measuring what the sibling's comment did *not* cover rather than competing with it. Verdict: bug /
medium / P2, SPIR-V emit + diagnostics. Nothing mutated (state/labels/Type/assignee/milestone
identical pre- and post-post). ⭐ **Scoping to a delta on discovering a sibling already posted is the
right move and worth copying** — the alternative is two verdicts on one issue under one identity.

⚠️ **Comments went 2 → 3 at 07:23:12Z (cmt 5201650926) while we were closing** — a second sibling
publication inside one hour, which is exactly why a footprint census cannot be carried across a turn.
The sibling split the ABI hole out as **#12387** (*AbortCompilationException escapes
precompileForTarget through the public C ABI, which is declared SLANG_NO_THROW*, OPEN, Type Bug, **no
labels**, created 07:22:52Z). ✅ **Verified independently — it publishes as me:** the `loadModule`
boundary guard is real (`slang-session.cpp:205-226`, **3** catch clauses — `AbortCompilationException`,
`Exception`, `...` — each returning `nullptr` + diagnostic), and both precedents are
**closed-completed** and the same class against `loadModule`: **#6988** (*Internal error leak from
`loadModule` through `DiagnosticSink::diagnoseRaw`*, Type Bug) and **#5950** (*Undefined exceptions
thrown by public API*). ⇒ The fix shape is **established in-tree, not novel**. #12387 is the sibling's
chain, not mine.
⚠️ `slang-triager` set #12387's Type to `Bug` (convention unambiguous) and **deliberately left it
unlabeled** — an ABI/exception-safety issue, so the sibling trio's `Diagnostics`/`spirv_validation`
would be wrong. ⭐ **Closing a Type gap is convention; guessing a label is authorship.** Labels stay
with the filer.
⛔⭐⭐⭐ **AND THE FILER THEN APPLIED EXACTLY THAT SET — 07:33:27Z `reproduced`+`spirv_validation`,
07:33:55Z `Diagnostics` — i.e. the restraint was right BECAUSE the judgment behind it was wrong.**
Had the triager acted on its own (defensible) read, it would have imposed a label set the owner had to
undo. ⇒ ⭐⭐⭐ **The value of "guessing a label is authorship" is precisely that it holds when your own
judgment differs from the owner's — a deference rule that only binds when you agree is not a rule.**
This is a stronger argument for the line than the one given when it was stated, and it generalizes: for
any *authorship*-class decision (labels, titles, scope), being confidently mistaken costs nothing if you
declined to act, and costs an undo if you didn't.

✅ **Finding 3's correction does NOT undermine the triager's published wording — re-verified.** CLI
`-incomplete-library` falls through to `linkage->m_optionSet.set(...)`: its `case` is at
`slang-options.cpp:2813`, inside the group whose single write is `:2821`. That is the **session** set,
so it flows session → `TargetRequest` → `TargetProgram` and reaches **both** gates. The
request→program-only asymmetry only voids the *`TargetProgram`-local* write that
`precompileForTarget` does.

## ✅ FINDING 1 IS RESOLVED UPSTREAM — the fixer replaced the control (verified 07:5xZ)

**#12382's body at head `f93eb4f74a` (updated 07:46:07Z, still draft) no longer uses the voided
control.** It now:
- Promotes the **reverted-build column** to *"the load-bearing control"* — all three tests fail with
  `Validation of generated SPIR-V failed` on a build without the fix ⇒ validation demonstrably still
  rejects, **independent of any option state** (the rejected compile is the entry point's, which sets no
  `EmbedDownstreamIR`). Stronger than what it replaced.
- Keeps my **line-5 shape** as an explicitly *"second, weaker control"* — ✅ **re-verified on my mount:
  exit 0, 376 B, 0 Linkage errors**, matching the body byte-for-byte. It correctly states it *"shows the
  absence of a regression, not the presence of rejection"* — the exact bound I attached when offering it.
- Adds a ⚠️ **"Deliberately not used as a control"** paragraph naming the `-embed` shape, #12385, and the
  failure mode verbatim: *"a fix there would flip it to passing — an assertion keyed on it would silently
  invert into a green check certifying nothing, with no test failure to surface it."*

⭐⭐ **The chain worked as intended: a finding raised on a draft, routed through the triager, landed as a
PR-body change before the PR was reviewable — and the hedge I attached to the weaker replacement
survived every hop into the public artifact.** Cf.
[[feedback_a_downstream_fix_can_void_an_upstream_published_control]].
⭐ Also folded in: the test comment now explains the `"0"` window as *this* issue's gap and cites #12385
(so `needsValidation`'s ignorance of `EmbedDownstreamIR` is documented at the workaround), and #12383 is
now cited by number in *Known limitation* — closing the dangling-recommendation gap noted in
[[project_12383_spirv_validation_before_spvopt_strip]].

⚠️ **New disclosure in that body worth carrying: CI has verified NOTHING on this PR.** ⛔ **My first
relay of this said "every run yielded, all build/test skipped" — that was the PR BODY's wording
repeated as if counted. Measured independently at `f93eb4f74a` (84 check-runs), the peer's breakdown is
right and mine understated what exists:**

```
74 skipped  ·  8 success  ·  2 failure
  successes: board-sync ×5, filter, reuse-compliance-check ×2   <- none compiles or tests
  failures:  check-ci, wait-for-human-priority                  <- the gate itself
  build-*/test-*: 58, ALL skipped, zero non-skipped conclusions
```

⇒ ⭐⭐⭐ **84 checks exist, 8 executed, 0 verified the change** — the *configured / executing /
blocking* distinction, third rung. **"Every run yielded" reads as 84 skipped and is false; "8
successes" on the PR page invites the opposite inference and is equally false.** Publish the shape,
never the summary. ⭐⭐ **And I introduced the error by relaying a body's prose as a measurement** — the
figures were one `check-runs` call away. Cause is
structural, not this branch's: a draft gets no `pull_request` CI (`ci.yml`'s `filter` job gates on
`draft != true`), so the bot dispatches manually, and those yield while higher-priority CI is active —
and `extras/ci/retry-yielded-bot-ci.py` returns early while any run is `waiting`, so **one run parked on
a manual environment approval suppresses bot retries repo-wide.** ⚠️ **That mechanism is the PR body's
claim, which I relayed and have NOT verified from my edge — the peer recorded it as attributed-to-me,
plausible-not-verified, which is the correct disposal.** The check-run *counts* above are mine, measured.
⇒ The "all green" suite figures in the body are **local only**. Do not read them as CI signal.

## ⚠️ REOPENED by maintainer 2026-08-06 (cmt 5363717934, jkwak-work)

jkwak-work commented: *"I don't think `-embed-downstream-ir` is a complete feature yet … appears
under 'Experimental' … going to mark this **unplanned** because we don't have a clear plan of when the
feature can be completed."* — a disposition signal (WontFix-adjacent), not a technical rebuttal.

✅ **His factual premise VERIFIED on my mount:** `slangc -h` line 285 `Experimental options (use at
your own risk)`, line 298 `-embed-downstream-ir`. So the flag is genuinely experimental — his reasoning
is grounded.

⚠️ **RESOLVED: triager acknowledged `unplanned` without contesting, posted cmt 5363797594 (stacked 4→5),
changed no state.** jkwak (MEMBER) did the retriage himself at 00:32:09Z — **Type Bug→Feature**, dropped
`Diagnostics`+`spirv_validation`, left `reproduced`. Authoritative human triage ⇒ nothing to change.

⛔ **I raised a CI-blast-radius nuance for the triager to weigh, and TWO of my figures in it were WRONG
— corrected by the triager and re-verified by me at HEAD `de679fdc3` (my mount advanced weeks; master
moved):**
- ❌ **"CI exports it globally / 7 workflows"** → ✅ **6 files set it in specific job steps**
  (`ci-slang-coverage-test`, `-sanitizer`, `-test`, `-test-container`, `nightly-slang-test`,
  `nightly-remix-test`); the 7th, `claude-ci-analysis.yml:243`, only **mentions it in prose guidance**.
  My grep-count of 7 conflated a prose mention with a functional `export`.
- ❌ **"acute CI pain"** → ✅ **latent, not acute.** The in-process precompile-to-SPIRV test
  (`unit-test-precompile-exception-boundary.cpp`, the #12387 boundary test) **fails at emission before
  validation** — its own comment (`:18`): *"reaches the failure without a GPU or SPIR-V validation."*
  And #12382 still parks the `="0"` window pointing here. Verified: gate still has **0**
  `EmbedDownstreamIR` refs (unfixed), but nothing is broken today.
⇒ ⭐⭐ **The over-fire is real and feature-independent, but the disposition does not turn on it, so the
triager cut the nuance rather than posting four fragile claims to a maintainer who could disprove any in
one grep** — codex flagged its first draft must-fix ×4, incl. a flat-false *"the only in-tree test"*
(two others also precompile to SPIRV). ⭐⭐⭐ **A reply to a DECIDED maintainer that adds an unrequested
technical nuance is a liability: every claim is a falsification target and the decision doesn't hinge on
it. Cut, don't qualify.** Final public reply = 2-sentence acknowledgement + one future breadcrumb (the
over-fire is documented in #12382 for whoever revives the feature).
⛔ **My own lesson from this: I published "globally/7" and "acute" into this leaf as measured facts;
both were overstatements that a peer had to catch.** The `grep -rl … | wc -l` = 7 was a true file-count
of an untrue predicate ("sets the env var") — [[feedback_two_readers_of_one_option_name_may_read_different_objects]]
shape (a match on presence is not a match on role). ⇒ **A file that MENTIONS a token ≠ a file that
ACTS on it; classify the occurrence before counting it.**

**CO-TRIGGER = #12382 merges** ⇒ the fix is unblocked. Open question published as open: whether the
linked check covers a malformed library body. No fixer dispatched — the control replacement and
landing order are the PR author's and a maintainer's calls.

RESUME: #12382 merging, or any non-bot comment on #12385 (both arrive by webhook — no guard armed,
same reasoning as [[project_12383_spirv_validation_before_spvopt_strip]]).
Findings 1–4 all stand as of 06:55Z, with 1 upgraded from proxied to measured.

Related: [[project_12371_spirv_prelink_validation_buffer]] (parent chain),
[[project_12383_spirv_validation_before_spvopt_strip]] (sibling spin-off),
[[feedback_a_downstream_fix_can_void_an_upstream_published_control]].
