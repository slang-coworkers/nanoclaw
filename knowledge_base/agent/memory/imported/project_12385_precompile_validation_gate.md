---
name: project_12385_precompile_validation_gate
description: "slang#12385 — shouldRunSPIRVValidation over-fires on a precompile (EmbedDownstreamIR) so a library is rejected for the Linkage/Export that make it linkable. Bot-filed, self-triaged, findings verified. RESOLVED by maintainer: retriaged Bug→Feature and marked unplanned (the -embed-downstream-ir feature is experimental); the over-fire is real but feature-independent and is documented in PR #12382 for whoever revives it."
metadata: 
  node_type: memory
  type: project
  originSessionId: 4b1a5bcd-08bf-44bc-8aec-5d69d5200ff6
---

# slang#12385 — SPIR-V validation runs on a precompile that is not a final module

Filed 2026-08-06 by `nv-slang-bot[bot]` (author of PR #12382, a spin-off of the #12371 chain), self-labeled
`Diagnostics` + `spirv_validation` + `reproduced`. Canonical thread `gh-issue-shader-slang/slang-12385`.

## The finding (verified at source, not inherited from the body)
`shouldRunSPIRVValidation` over-fires when a precompile embeds downstream IR. `-embed-downstream-ir
-profile lib_6_6` on `tests/library/export-library-generics.slang`: env=1, no `-incomplete-library` →
**exit 255**, no module, `Capability Linkage is not allowed by Vulkan 1.4`; adding `-incomplete-library`
→ exit 0. So the gate rejects a library for the Linkage/Export that make it linkable.
`precompileForTarget` (`slang-compiler-tu.cpp:132,137,145`) sets exactly `GenerateWholeProgram`, `Profile`
(DXIL only), `EmbedDownstreamIR` — and **neither** `SkipSPIRVValidation` nor `IncompleteLibrary` (0
occurrences in the file). ⭐ The gate reads `getTargetProgram()->getOptionSet()` (`slang-emit.cpp:3266`)
— the same object `precompileForTarget` populates — so a fix predicate placed there **does** reach the
public-API path.

## Resolution — maintainer disposition, not a code fix here
jkwak-work (MEMBER) retriaged it himself: **Type Bug→Feature**, dropped `Diagnostics`+`spirv_validation`,
kept `reproduced`; rationale — `-embed-downstream-ir` is under "Experimental options" (`slangc -h`), so
"no clear plan of when the feature can be completed" ⇒ **unplanned** (WontFix-adjacent, a disposition
signal, not a technical rebuttal; his factual premise verified). The over-fire is **real and
feature-independent** but the disposition does not turn on it, so the triager acknowledged `unplanned`
without contesting and mutated no state. The over-fire is documented in **PR #12382** (its unit test
comments the gate at `unit-test-spirv-link-validation.cpp:97-99`, *"once that gate is fixed this window
can be removed"*) for whoever revives the feature. **RESUME:** #12382 merging, or any non-bot comment
(both arrive by webhook — no guard armed).

## The finding that mattered to the PR — a downstream fix would VOID an upstream control (RESOLVED)
The obvious fix would have flipped PR #12382's own manual control (`precompiled-glsl.slang` with
`-embed-downstream-ir`, `-skip` removed, env=1, asserting the compile is *still rejected*) from failing
to passing — the exact signature #12382 states would mean *"this change quietly disabled validation."*
Routed on the PR's chain (`gh-issue-shader-slang/slang-12371`); the fixer then **replaced the control
upstream** at head `f93eb4f74a`: it promotes the reverted-build column to the load-bearing control (all
three tests fail with `Validation of generated SPIR-V failed` on a build without the fix, independent of
option state) and keeps the weaker line-5 shape explicitly labelled as showing *absence of a regression,
not presence of rejection* — the exact hedge that had been attached to it survived every hop.
⇒ [[feedback_a_downstream_fix_can_void_an_upstream_published_control]]

## Sequencing constraint
Land the fix **after** #12382 merges (never flip ready/approve/merge — see
[[project_12371_spirv_prelink_validation_buffer]]). The fix removes the only validation that currently
inspects a precompiled module's bytes **as a standalone artifact**; after #12382 the *linked* artifact is
validated, but whether that check covers a malformed library **body** is unresolved — published as
unresolved rather than asserted. Sequencing risk, not a proven hole.

## Durable lessons (mostly cross-linked)
- ⭐ **A shared arm is not a confound; a side effect is.** A proxy using an arm of the gate under test is
  fine when the gate has one consumer (`slang-emit.cpp:3390`), so all arms are interchangeable there; the
  real confound was that `-incomplete-library` had a *second* effect — so de-confound with
  `-skip-spirv-validation`, which has no consumer outside the gate.
  ⇒ [[feedback_a_shared_arm_is_not_a_confound_a_side_effect_is]]
- ⭐⭐ **Two readers of one option name may read different objects.** `IncompleteLibrary` set on the
  precompile's own `TargetProgram` never reaches the unresolved-symbol gate (inheritance runs
  request→program only), while the CLI `-incomplete-library` lands on the session set and flows to both
  gates. "Same option name" hid the directional flow: verify not just that both readers exist but that
  the writer's object reaches the reader's. ⇒ [[feedback_two_readers_of_one_option_name_may_read_different_objects]]
- ⭐ **A footprint census is invalidated by any sibling on the same bot identity, and there is no channel
  that announces one** — re-`gh api` the comment list at the moment of the claim; never carry it across a
  turn. (A sibling posted under our shared `nv-slang-bot[bot]` id ~10 min before I asserted "zero public
  footprint".) ⇒ [[feedback_a_shared_bot_identity_makes_a_footprint_census_stale_on_arrival]]
- ⭐⭐⭐ **Closing a Type gap is convention; guessing a label is authorship.** The triager set a sibling
  spin-off's Type (unambiguous) but left it unlabeled — and the filer then applied a *different* label set
  than the triager would have. The deference rule binds precisely when your own judgment differs from the
  owner's; a rule that only binds when you agree is not a rule.
- ⭐⭐⭐ **A reply to a DECIDED maintainer that adds unrequested technical nuance is a liability** — every
  claim is a falsification target and the decision doesn't hinge on it. **Cut, don't qualify** (codex
  flagged four must-fix errors in the first over-nuanced draft). Final reply = a two-sentence
  acknowledgement + one breadcrumb.
- ⛔ **A file that MENTIONS a token ≠ a file that ACTS on it — classify the occurrence before counting
  it.** `grep -rl … | wc -l = 7` was a true file-count of an untrue predicate (one file only *mentioned*
  the env var in prose). Same shape as reading a presence match as a role match.
- ⛔ **The byte count of the produced module is BUILD-DEPENDENT** (83900 / 83916 / 83924 seen across
  clones/configs) — do not quote it as a finding. Durable parts: the 2-of-7 census of droppable
  `-skip-spirv-validation` test lines, and the exit codes (255→0, *a module produced at all vs none*).

Related: [[project_12371_spirv_prelink_validation_buffer]] (parent chain),
[[project_12383_spirv_validation_before_spvopt_strip]] (sibling spin-off).
