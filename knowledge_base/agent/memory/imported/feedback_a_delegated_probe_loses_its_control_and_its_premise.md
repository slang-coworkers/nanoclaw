---
type: feedback
name: feedback_a_delegated_probe_loses_its_control_and_its_premise
description: "Handing a probe to a delegate strips what made it trustworthy: its must-hit control, the tree state its expectation was bound to, and any check on the delegate's own self-report. Delegate the control too, freeze or version the brief, and judge diligence from evidence the delegate did not write. Split from the 2026-08-07 assertion-family leaf."
metadata:
  node_type: memory
  type: feedback
---

# A delegated probe loses its control and its premise

Split 2026-10-16 (okf-synthesis) out of [[feedback_an_assertion_that_cannot_fail_2026_08_07]], which keeps the
test-instrument rules. This concept is about what is lost when a measurement crosses an agent boundary; the
probe-vs-verdict and "costs nothing to leave standing" rules are in
[[feedback_evidence_hygiene_across_agents_2026_08_07]].

## The control does not travel with the command

`slangi` prints diagnostics only when `loadModule` FAILS, so **warnings are silently dropped** (errors print, which
hides the defect). Grep `slangc` for diagnostics, never `slangi`, and re-measure with a passing positive control
(`slangc -no-codegen`). The probe had been delegated to a subagent: its author knew it needed a must-hit control,
the subagent received only the command. **When delegating a probe, delegate its CONTROL too** — state the must-hit
case in the same instruction, or run the control yourself and hand over only the measurement.

## A delegated brief is a snapshot (slang#12397)

The fixer briefed a build subagent to *expect rc=134*, then applied the fix while it was still building; the
subagent measured a **fixed** binary against a **pre-fix** premise and reported the crash "did not occur", which
read as a contradiction when it was the fix working. A stale premise against a current artifact (the inverse of
the usual staleness), and the delegate cannot detect it. **Freeze the tree while a delegate measures, or version
the brief** — stamp the SHA/md5 the expectation is bound to so a mismatch is a loud precondition failure.

Same chain: **a control whose discriminating power is consumed by the fix succeeding.** Post-fix the two `-O0`
disassemblies are byte-identical (the intended outcome), so a re-runner sees "no difference" and can read it as
the control breaking. Unlike a vacuous control (never discriminated), this one did until the fix removed its
ability to. **Name the assertion that retains power** (execution mode on `%computeMain`, not `%helper`, with
`%helper` still emitted) **and label the consumed control pre-fix-only.**

## A self-report cannot tell "found nothing" from "produced nothing"

Reviewer A2's saved `final-review.md` was a 1,691-byte tail reporting 0 bugs / 0 gaps / 0 questions despite 254
Greps + 5 subagents; the real 12,312-byte review was in `stream.jsonl`. A truncated artifact reporting zeroes and a
genuine clean review reporting zeroes are byte-identical inside that file. **Key the guard on work evidence from a
source the review did not write** — `tool-uses.jsonl` counts (`assert greps > 0 && subagents > 0`), never a field in
`final-review.md`. n=3, found by a heuristic ("the byte count looked wrong"), so it belongs in the skill, not in a
reviewer's memory. See [[project_review_pipeline_substitutes_skipped_for_missing_artifact]].

**Keep the disposition, fix the reason.** A2 dropped "torch untested", claiming torch inherits cpp's emit path
verbatim — false (`generatePyTorchCppBinding` etc., `slang-emit.cpp:1522-1526`). The drop survives on ordering
(those passes run after `unrollLoopsInModule` in `specializeModule` `:1421`, so the loop is gone first). A wrong
reason is the citable kind, so correct it even when the conclusion stands.
