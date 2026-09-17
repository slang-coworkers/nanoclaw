---
name: feedback_an_assertion_that_cannot_fail_2026_08_07
description: "The 2026-08-07 spill of the assertion-that-cannot-fail family: CHECK-NOT is a FileCheck directive absent from diag=; the drill's own blind spot (a FAILED arm from the wrong cause); prose has no instrument; a repeated zero from a freshly-fixed regex; delegating a probe strips its control; probe-beats-verdict; 'no longer applies' and 'cannot be reached' are one claim; the reading that costs nothing to leave standing goes unaudited."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ca41560b-b199-4c60-94f8-8afbca9f7f07
---

# An assertion that cannot fail — the 2026-08-07 instances

⛔ Split out of [[feedback_optimized_lane_can_be_inert_for_the_fix]] at the ~24,986 B Read limit (which truncates NEWEST content first). The parent keeps the origin case, the `CHECK-NOT`-must-be-bounded rule, and the harness's-own-invocation rule. Some cross-agent entries (probe-vs-verdict, costs-nothing-to-leave-standing, the state-claim symmetry, debug-line-table, recalled-vs-default, my prefix-read error) moved to [[feedback_evidence_hygiene_across_agents_2026_08_07]].

## THE FAMILY RULE — make every negative assertion fail on purpose once

⭐⭐⭐ **A harness pass/fail is a CONJUNCTION over everything it checks: it can REFUTE a specific claim, never CONFIRM one.** So for any negative assertion, **flip it to a pattern you KNOW is present; if the test still passes, the assertion is inert.** That single drill catches every inertness mechanism — including ones nobody has enumerated. A trap list grows without bound and is always one mechanism behind; the drill is closed-form. When a claim is about one property, read the **artifact carrying that property** (the diagnostic text, the emitted symbol), not the verdict.

**Five distinct mechanisms by which a `CHECK-NOT` in this repo is inert** (only #5 is structural — inert on every input):
1. **unbounded / EOF-bounded** — the occurrence hides right before the positive anchor.
2. **stream-ordering** — `slang-test-main.cpp:1882-1890` appends stderr BEFORE stdout, so a `-NOT` anchored after a positive is already past the text ([[project_12330_entrypoint_throws_not_diagnosed]]).
3. **pattern never present anyway** — passes even when flipped to a present pattern ([[project_10918_debug_global_variable_rework]]).
4. **vacuous by construction** — `tests/cuda/optix-exported-device-function.slang` ([[project_12182_cuda_optix_callable_rdc_linkage]]).
5. **wrong matcher — the directive does not exist** (below).

## `CHECK-NOT` / spaced `// CHECK:` — two matchers, one token `CHECK`

`docs/diagnostics.md` mentions `CHECK-NOT` **zero** times; the `diag=` grammar has no negative form at all (message text · severity · error code · caret columns; default exhaustive mode). There are **two matchers**, and a rule true for one is false for the other — and it crosses silently because both spell `CHECK`:

| directive | matcher | `CHECK-NOT` | spaced `// CHECK:` |
|---|---|---|---|
| `filecheck=` / `filecheck-buffer=` | real LLVM FileCheck (`slang-llvm-filecheck.cpp:92`, bare prefix scanned anywhere on line) | ✅ (subject to bounding) | ✅ fine |
| `diag=` | slang-test's own parser (`diagnostic-annotation-util.cpp:84-86` builds `"//"+prefix+":"`, `:181` `startsWith`) | ⛔ not in grammar | ⛔ INERT (the interior space fails `startsWith`) |

⇒ Under `diag=` assert an absence via **exhaustive mode** (every emitted diagnostic must carry an annotation). ⭐⭐⭐ **Before applying any annotation-syntax rule, read the DIRECTIVE on line 1** (`DIAGNOSTIC_TEST`/`diag=` vs `SIMPLE(filecheck=)`), not the annotation. Measured convention is the opposite of the intuition: spaced `// CHECK:` **3,834** vs unspaced **2,135**; live tests rely on the spaced form exclusively.

⛔ **CORRECTION 08-08:** `trim()` removes leading **and** trailing whitespace (`source/core/slang-string.cpp:191-201`, two loops), not leading-only. And the offered reason for the fix was itself unfalsifiable ("leading-only predicts a trailing-space line fails too, which it doesn't") — no such input exists by construction. ⇒ ⭐⭐ **Fix a false fact in a durable record BECAUSE IT IS FALSE, never because "it predicts something testable" until you have built the input** — the peer flagged the "no discriminating observation" pattern, then *fabricated* one to justify the fix. **Cite the argument, not a search:** a bounded search leaves a "maybe at length N" residue the argument forecloses.

⭐⭐⭐ **WHY THE FALSE HALF SURVIVED ITS AUTHOR'S REVIEW (the transferable shape):** it was **welded to a TRUE conclusion** ("not simply re-enableable") that was *already fully supported* by a sufficient other half (the test expects `error 50100` vs today's `error[E50100]`). No outcome could contradict the false half, yet it implied something drastic. ⇒ **When a caveat has two independent supports and one is sufficient, the other is carried by the conclusion rather than by evidence — audit it separately.** Retracted publicly in place (#10892 cmt `5226850234`) with the wrong wording quoted inside the retraction, verified **positionally** (marker offset 6833, quoted claim 6966) — a count cannot distinguish an assertion from a retraction; a phrase spanning a line break returns an empty context window, so re-read whitespace-collapsed.

## The drill's own blind spot — a FAILED arm can fail for the wrong reason

Revert-drill ARM B reported `FAILED` (the wanted result, so it was banked), but the actual failure was `Exhaustive check failed: 2 diagnostics without annotations` — an artifact of its own edit; the binary actually named `f(float)`, the correct answer. ⇒ ⭐⭐⭐ **The unaudited reading is THE ONE THAT CONFIRMS YOUR HYPOTHESIS — and which polarity that is flips per arm** (revert drill: you want `FAILED`, so `FAILED` is unaudited; green-build check: you want `EXIT=0`). **Before reading any arm, name which outcome you are hoping for — that is the one that needs its cause confirmed.** "Distrust bad news" and "distrust good news" are both wrong halves; distrust the *expected* news. A blank is SAFER than a wrong-cause confirmation, because absence prompts investigation while a confirming-direction result terminates it.

⛔⭐⭐⭐ **Worst case: an uncontrolled detector returned a FALSE POSITIVE that EXONERATED the gap it was checking.** Enumerating `SV_Target` shapes for a coverage hole, the first regex reported 6 "mixed" hits (including its own test file) ⇒ "already covered, non-issue" — because it classified `float4` as an aggregate type. Rewritten with a builtin-type predicate **plus a must-hit control** against the known Metal case; only then does the **0** for `tests/spirv`/`tests/glsl` carry information (shape 6 has zero Khronos coverage — the actual hole). ⇒ ⭐⭐⭐ **Rank a detector's failure by WHAT IT LICENSES, not whether it errs.** A false negative wastes a search; a false positive that exonerates ENDS it and closes a real defect as covered. **Any detector whose output could CLOSE an investigation needs its control run FIRST.**

## `slangi` drops warnings; and delegating a probe strips its arming obligation

`slangi` prints diagnostics only when `loadModule` FAILS, so **warnings are silently dropped** (errors do print, which hides the defect). ⇒ **Grep `slangc` for diagnostics, never `slangi`**; re-measure with a passing positive control (`slangc -no-codegen`). ⭐⭐⭐ **The probe was delegated to a subagent and the arming obligation evaporated in transit** — the author knows the probe needs a must-hit control; the subagent receives only the command. ⇒ **When delegating a probe, delegate its CONTROL too** — state the must-hit case in the same instruction, or run the control yourself and hand over only the measurement.

## A self-report cannot distinguish "did the work, found nothing" from "produced no work product"

Reviewer A2's saved `final-review.md` was a 1,691-byte tail reporting **0 bugs / 0 gaps / 0 questions despite 254 Greps + 5 subagents**; the real 12,312-byte review was in `stream.jsonl`. A summarizer reading the saved file would report "A2 found nothing," and nothing downstream would contradict it. ⇒ ⭐⭐⭐ **The guard must key on work evidence from a source THE REVIEW DID NOT WRITE** — the `tool-uses.jsonl` counts, never a field inside `final-review.md` (a truncated artifact reporting zeroes and a genuine clean review reporting zeroes are byte-identical *inside* that file). Shape: `assert greps > 0 && subagents > 0` against externally-sourced counts. n=3, discovered by a heuristic ("byte count looked wrong"), so **wire it into the skill, not the reviewer's memory.** Any agent's self-report of its own diligence is unfalsifiable from inside the report.

✅ **Companion — keep the disposition, fix the reason.** A2 dropped "torch untested" claiming torch inherits cpp's emit path *verbatim* — FALSE (torch has its own passes: `generatePyTorchCppBinding` etc., `slang-emit.cpp:1522-1526`) — but the drop survives on **ordering** (those torch-only passes run at `:1522-1526`, after `unrollLoopsInModule` in `specializeModule` `:1421`, so the loop is gone before any torch pass sees the IR). Right conclusion, wrong reason — and the wrong reason is the CITABLE kind, so correct the basis even when the disposition is unchanged.

## A repeated zero from a freshly-fixed regex reads as confirmation

Three rounds, three wrong zeros counting CUDA tests. Root cause (durable repo fact): **in a slang-test directive the flag follows a COLON, not whitespace** — `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-cuda -compute` — so any whitespace-anchored pattern is structurally blind to the first flag after the colon; use a class `[:[:space:]]` (correct count 12). ⇒ ⭐⭐⭐ **After fixing a probe that returned zero, do NOT re-run it for confirmation — run it against a case you KNOW must hit.** Two runs of your pattern are not two independent measurements if the second inherits the first's anchoring assumption. Also: the triage claim "0 files contain `-target cuda`" was **LITERALLY TRUE while answering the wrong question** (12 files reach CUDA under a different spelling). ⇒ "Is this true?" and "does this answer my question?" are different audits; the dangerous inherited fact is the TRUE one whose scope is implicit. (Consequence inverted the finding: buffer-comparing tests cannot observe a dropped inlining hint, so the 12 files are non-regression evidence, not a missed-coverage gap.)

## Prose has no instrument — so review need is inverted

A comment / doc / PR-body edit has **no assertion to arm**: no test turns red on a wrong comment, nor on a wrong CORRECTION to a wrong comment. Evidence: codex caught the same class TWICE on one CUDA `[noinline]` comment — v1 "nvcc rejects `__noinline__` on kernels" (false: it accepts and ignores); the correction over-claimed the other way ("meaningful only on the device branch" — false, `[CudaHost]` can be inlined into host callers; `__host__` is excluded by product scope, not meaninglessness). ⇒ ⭐⭐⭐ **Rank review need by whether the change has a failure mode, and prose ranks HIGHEST, not lowest.** Code carries a test that can contradict the author; prose carries nothing, so the author's confidence travels unchanged into the fix. **An external reader is the only instrument for a prose claim** — cite the artifact that grounds it (`file:line` + the ref you measured at), or state only what's verifiable from the code in front of the reader.

## Two more members, from slang#12397

1. **A delegated brief is a SNAPSHOT.** The fixer briefed a build subagent to *expect rc=134*, then applied the fix while it was still building; the subagent measured a **fixed** binary against a **pre-fix** premise and reported the crash "did not occur" — reading as a contradiction when it was the fix working. A stale PREMISE against a current artifact (inverse of usual staleness); the delegate cannot detect it. ⇒ **Freeze the tree while a delegate measures, or version the brief** (stamp the SHA/md5 the expectation is bound to, so a mismatch is a loud precondition failure).
2. **A control whose discriminating power is CONSUMED by the fix succeeding.** Post-fix the two `-O0` disassemblies are byte-identical (the intended outcome), so a reader re-running it sees "no difference" and can read it as **the control breaking**. Distinct from vacuous (never discriminated) and inert (structurally cannot): this one DID, then the fix removed its ability to. ⇒ **Name the assertion that RETAINS power** (execution mode on `%computeMain`, not `%helper`, with `%helper` still emitted) **and label the consumed control as pre-fix-only.**

⭐ Append-only build mystery closed: the harness killed the wrapper at 227/1453, it relaunched under `setsid`, ninja resumed 227 cached / 1226 replanned — the two-denominator artifact ([[feedback_a_monitor_timeout_kills_the_build_it_watches]]); host load 151.83 on 8 cores (~19× oversubscribed). Slow, not broken — and the diagnosis preceded the confirmation, the right order.

Related: [[project_12185_bindless_texture_nv_desc_handle_nonimage]] · [[feedback_green_job_skipped_backend_zero_coverage]] · [[feedback_name_what_you_held_fixed]] · [[feedback_an_identifier_that_does_not_distinguish_its_members]].
