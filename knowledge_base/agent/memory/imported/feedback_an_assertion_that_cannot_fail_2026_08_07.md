---
type: feedback
name: feedback_an_assertion_that_cannot_fail_2026_08_07
description: "The assertion-that-cannot-fail family (2026-08-07 instances): flip every negative assertion to a known-present pattern once; five ways a CHECK-NOT is inert here (CHECK-NOT/spaced `// CHECK:` are inert under diag=); the drill's blind spot is the arm that confirms your hypothesis; a detector that can CLOSE an investigation needs its control first; a re-run of a freshly-fixed zero is not a second measurement; prose has no instrument. Delegation losses split to a sibling."
metadata:
  node_type: memory
  type: feedback
  originSessionId: ca41560b-b199-4c60-94f8-8afbca9f7f07
---

# An assertion that cannot fail — the 2026-08-07 instances

Split out of [[feedback_optimized_lane_can_be_inert_for_the_fix]] (which keeps the origin case, the
`CHECK-NOT`-must-be-bounded rule and the harness's-own-invocation rule). Cross-agent entries live in
[[feedback_evidence_hygiene_across_agents_2026_08_07]]; what a probe loses when delegated (its control, its
premise, the delegate's self-report) is [[feedback_a_delegated_probe_loses_its_control_and_its_premise]]
(split 2026-10-16 by okf-synthesis).

## The family rule — make every negative assertion fail on purpose once

**A harness pass/fail is a conjunction over everything it checks: it can refute a specific claim, never
confirm one.** For any negative assertion, flip it to a pattern you KNOW is present; if the test still passes,
the assertion is inert. That one drill catches every inertness mechanism, including unenumerated ones — a trap
list is always one mechanism behind. When a claim is about one property, read the artifact carrying that
property (the diagnostic text, the emitted symbol), not the verdict.

Five ways a `CHECK-NOT` in this repo is inert (only #5 is structural):
1. **unbounded / EOF-bounded** — the occurrence hides right before the positive anchor.
2. **stream ordering** — `slang-test-main.cpp:1882-1890` appends stderr before stdout, so a `-NOT` anchored after
   a positive is already past the text ([[project_12330_entrypoint_throws_not_diagnosed]]).
3. **pattern never present anyway** — passes even when flipped ([[project_10918_debug_global_variable_rework]]).
4. **vacuous by construction** — `tests/cuda/optix-exported-device-function.slang`
   ([[project_12182_cuda_optix_callable_rdc_linkage]]).
5. **wrong matcher — the directive does not exist** (next section).

## `CHECK-NOT` / spaced `// CHECK:` — two matchers, one token `CHECK`

`docs/diagnostics.md` never mentions `CHECK-NOT`; the `diag=` grammar has no negative form (message text ·
severity · error code · caret columns; default exhaustive mode). A rule true for one matcher is false for the other:

| directive | matcher | `CHECK-NOT` | spaced `// CHECK:` |
|---|---|---|---|
| `filecheck=` / `filecheck-buffer=` | LLVM FileCheck (`slang-llvm-filecheck.cpp:92`, bare prefix anywhere on line) | ✅ (subject to bounding) | ✅ |
| `diag=` | slang-test's parser (`diagnostic-annotation-util.cpp:84-86` builds `"//"+prefix+":"`, `:181` `startsWith`) | ⛔ not in grammar | ⛔ inert (the space fails `startsWith`) |

Under `diag=`, assert an absence via **exhaustive mode** (every emitted diagnostic must carry an annotation).
**Read the directive on line 1 before applying any annotation-syntax rule.** Convention runs against intuition:
spaced `// CHECK:` 3,834 vs unspaced 2,135.

**Correction 08-08:** `trim()` removes leading **and** trailing whitespace (`source/core/slang-string.cpp:191-201`).
The reason first offered for that fix was itself unfalsifiable (it "predicted" an input that cannot exist). **Fix a
false fact because it is false; cite the argument, not a bounded search.** The false half survived its author's
review because it was welded to a true conclusion ("not simply re-enableable") already carried by a sufficient other
support (`error 50100` vs today's `error[E50100]`) — **when a caveat has two supports and one suffices, audit the
other separately** ([[feedback_a_fused_claim_welds_a_true_fact_to_an_invented_one]]). Retracted in place (#10892
cmt `5226850234`), verified positionally — a count cannot tell an assertion from its retraction.

## The drill's blind spot — the arm that confirms your hypothesis

Revert-drill arm B reported `FAILED` (the wanted result, so it was banked), but the failure was `Exhaustive check
failed: 2 diagnostics without annotations` — an artifact of its own edit; the binary actually named `f(float)`,
the correct answer. **Before reading any arm, name the outcome you hope for — that is the reading that needs its
cause confirmed.** Polarity flips per arm (revert drill wants `FAILED`, green-build check wants `EXIT=0`). A blank
is safer than a wrong-cause confirmation: absence prompts investigation, confirmation ends it.

**Worst case — an uncontrolled detector's false positive exonerated the gap it checked.** Enumerating `SV_Target`
shapes, the first regex found 6 "mixed" hits (one its own test file) ⇒ "already covered", because it classed
`float4` as an aggregate. With a builtin-type predicate and a must-hit control on the known Metal case, the 0 for
`tests/spirv`/`tests/glsl` became information: shape 6 has zero Khronos coverage. **Rank a detector's failure by
what it licenses:** a false negative wastes a search, a false positive that exonerates closes a real defect.
**Any detector whose output could close an investigation runs its control first.**

## A repeated zero from a freshly-fixed regex is not a second measurement

Three rounds, three wrong zeros counting CUDA tests. **In a slang-test directive the first flag follows a colon,
not whitespace** — `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-cuda -compute` — so a whitespace-anchored
pattern is blind to it; use `[:[:space:]]` (correct count 12). **After fixing a probe that returned zero, run it
against a case that must hit, not again for confirmation** — the second run inherits the first's anchoring. The
triage claim "0 files contain `-target cuda`" was literally true and answered the wrong question; "is it true?" and
"does it answer my question?" are separate audits. (Buffer-comparing tests cannot observe a dropped inlining hint,
so those 12 files were non-regression evidence, not a coverage gap.)

## Prose has no instrument — so its review need is highest

No test turns red on a wrong comment, or on a wrong correction to one. Codex caught the same class twice on one CUDA
`[noinline]` comment: v1 "nvcc rejects `__noinline__` on kernels" (false — accepted and ignored); the correction
over-claimed the other way ("meaningful only on the device branch" — `[CudaHost]` can be inlined into host callers).
**Rank review need by whether the change has a failure mode; prose ranks highest.** An external reader is the only
instrument for a prose claim — cite `file:line` + the ref you measured at, or state only what the code shows.

Related: [[project_12185_bindless_texture_nv_desc_handle_nonimage]] · [[feedback_green_job_skipped_backend_zero_coverage]] ·
[[feedback_name_what_you_held_fixed]] · [[feedback_an_identifier_that_does_not_distinguish_its_members]] ·
[[feedback_a_monitor_timeout_kills_the_build_it_watches]] (the 227/1453 two-denominator build artifact from the same day).
