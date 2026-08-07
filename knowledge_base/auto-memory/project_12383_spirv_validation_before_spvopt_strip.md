---
name: project_12383_spirv_validation_before_spvopt_strip
description: "slang#12383 — SPIR-V validation runs BEFORE spirv-opt and before debug-stripping, so shipped bytes were never validated. Bot-filed spin-off of #12371, fully triaged in its own body. PARKED: needs a policy decision + a suite survey, and both adjacent issues (#12247, #8681) are jkwak-assigned. RESUME: human comment on #12383 (arrives by webhook — no guard armed)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 0dacff7c-b2e0-4955-93f6-07f27abcd3f8
---

# slang#12383 — validation is mid-pipeline, not at finalisation

Filed 2026-08-06 06:08:02Z by `nv-slang-bot[bot]` as the spin-off our own #12371 chain promised.
OPEN, **0 comments**, no assignee, Issue Type **Bug**, labels `Diagnostics` + `spirv_validation`.

**Not a report that Slang emits invalid SPIR-V.** The body is explicit: four shipped artifacts were
fed to `glslang_validateSPIRV` after the fact and all four passed, with a malformed control
correctly rejected. The claim is narrower — **a supported configuration ships bytes nothing
checked.** Two instances in `createArtifactFromIR` (`source/slang/slang-emit.cpp`): `spirv-opt`
(validate `:3432`, compile `:3487`, artifact replaced `:3486`/`:3492`) and `-separate-debug-info`
(`stripDbgSpirvFromArtifact` `:3496`, `artifact = _Move(strippedArtifact)` `:3497`). The second is
independent of `-O` level and easy to miss.

## Why no fix chain was opened (deliberate, 2026-08-06 06:1xZ)

Three converging reasons, not one:

1. **It is a policy decision, not a bug fix.** Moving validation to finalisation *could newly
   reject output that ships today*. Nobody has surveyed how much. The body names the precondition
   itself: a full `slang-test` run with validation forced on at a **non-zero** optimisation level.
   That is a long run whose outcome licenses a behavioural change — operator's call to launch, not
   mine to start unasked.
2. **Both adjacent issues are maintainer-owned.** #12247 (*slang-test -O3 has 79 failures when
   spirv-opt is enabled suite-wide*) and #8681 (*use spirv-opt for debug-strip*) are **both OPEN and
   both assigned to `jkwak-work`**. Per [[feedback_no_autofixer_jkwak_self_filed]] that territory
   gets triage-and-park, never an auto-fixer.
3. ⭐ **The survey #12383 wants may substantially overlap #12247's existing baseline** — same suite,
   same optimiser setting. Not the same measurement (test failures ≠ validation rejections), so it
   does not *substitute*; but a maintainer weighing the cost should know the run may already be half
   done. This connection is the one piece of content the issue body does **not** carry.

#8681 would reshape instance 2 entirely — if debug-stripping moves into `spirv-opt`, the
strip-replaces-the-artifact instance stops existing in its current form.

## RESUME trigger — webhook, no guard

A human comment on #12383 arrives as an `issue_comment` webhook, which is a trigger whose *receipt*
I control. Deliberately **no cron guard armed** — contrast #12371, where the outstanding items were
a peer's PR number and an operator reply, neither of which announces itself. Arming a guard here
would be a redundant timer over a channel that already delivers. Stating this so the absence reads
as a decision, not an oversight ([[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]).

## Trail state — closed on the issue end, open on the PR end

Verified rather than inherited from the body's claim that "the trail is closed on both ends":

- ✅ **#12371's verdict comment 5197829621 DOES name #12383** (`updated 2026-08-06T06:08:36Z`, 34 s
  after the issue was created — the triager patched it in place).
- ⛔ **PR #12382's body does NOT name #12383.** Its *Known limitation* section (line 116 of the
  body) describes the defect accurately and ends *"Filing it as its own issue is the right next
  step"* — a dangling recommendation, because the issue number did not exist when the body was
  written. Three reviewers (A correctness / B Devin / C clarity) were mid-review on
  `5c4c63d17e` when #12383 was filed, so a reviewer hits that sentence with no way to see it was
  acted on. Mechanism: [[feedback_a_recommendation_cannot_cite_what_it_causes]].

Routed the forward-link patch to `slang-fixer` **through `slang-triager`** (direct edges only — the
fixer is triager's child, not mine) on `thread_id=gh-issue-shader-slang/slang-12371`, since the PR
is that chain's artifact.

## Provenance of the measurements in the body

Measured at `9cd92bb3a` (the #12353 merge) and re-confirmed against #12382's head `5c4c63d1`.
Size evidence for "the optimizer does change the shipped bytes":
`tests/library/precompiled-spirv-generics.slang` → **1668 B at `-O0`**, **964 B at default**, `cmp`
differs. Population context for the unrun survey: ~4,474 `.slang` files under `tests/`, ~1,239
mentioning `-target spirv`.

Related: [[project_12371_spirv_prelink_validation_buffer]] (parent chain),
[[project_12247_slang_test_o3_spvopt_baseline]], [[project_8681_debuginfo_strip_spiropt]],
[[project_12331_spirv_opt_size_preset_Os]].
