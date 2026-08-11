---
name: feedback_a_doctest_tally_counts_device_skipped_cases_as_passed
description: "slang-rhi's doctest summary prints an IDENTICAL '1267 | 1267 passed | 0 failed | 0 skipped' on a leg with a live GPU and on a leg where 824 cases printed SKIPPED (device not available) — the tally is blind to device skips, so it is never coverage evidence; and step-level 'Unit Tests :: success' is green on both"
metadata: 
  node_type: memory
  type: feedback
  title: A doctest tally counts device-skipped cases as passed
  tags: 
    - slang-rhi
    - ci
    - instrument-defect
    - coverage
    - green-means-nothing
  originSessionId: 67912aa9-ab11-43ae-8cf8-515bfed44987
---

# `1267 | 1267 passed | 0 skipped` is identical whether the GPU was there or not

**Measured 2026-08-10 on slang-rhi#598, run `31364278366`.** Two legs of the same run:

| leg | `Adapter Name` | `SKIPPED (device not available)` lines | doctest summary |
| --- | --- | --- | --- |
| `windows x86_64 msvc Release` | `NVIDIA GeForce RTX 5090` | **0** | `test cases: 1267 \| 1267 passed \| 0 failed \| 0 skipped` |
| `windows x86_64 clang Release` | *(none — no CUDA device)* | **824** | `test cases: 1267 \| 1267 passed \| 0 failed \| 0 skipped` |

**Byte-identical summaries.** 824 cases skipped for want of a device, and the tally says
`0 skipped` and counts every one of them as **passed**.

⇒ ⭐⭐⭐**"1267/1267 passing" is not coverage evidence in this harness — at all, in either
direction.** A device-skipped case is a *passing* case to doctest, because the skip happens inside
the case body (a `GPU_TEST_CASE` returns early when the device is unavailable) rather than via
doctest's own skip mechanism. Quoting the tally as proof a code path ran is the trap, and the number
looks maximally reassuring precisely when it is empty.

## This is one layer deeper than the standing green-job rule

The existing rule ([[feedback_green_job_skipped_backend_zero_coverage]], and the #811 lesson that a
log-derived census cannot tell "step absent" from "step skipped") says: **read
`.steps[].conclusion` from the API, never infer from logs.** That rule fixed *green job ≠ test ran*.

**This defect defeats it.** On #598, **8 of 19 jobs had `Unit Tests :: success` at the step level**,
but only **4** had a live CUDA device. The other four are step-green with every `.cuda` case
`SKIPPED (device not available)`. So:

- ⛔**Green JOB ≠ test ran** (old rule — step may be `skipped`).
- ⛔**Green STEP ≠ test ran** (this rule — the step *ran*, exited 0, and tested nothing).

**The step-conclusion API cannot see this.** `conclusion=success` is truthful: the process exited 0.
The only discriminator is in the log.

## The probes that work

For "did this backend actually execute?", in order of strength:

1. ✅**Count `SKIPPED (device not available)`** in the job log. `0` ⇒ live device. A large count on a
   step-green leg ⇒ **zero real coverage on that backend**.
2. ✅**Read the capability/adapter dump** — `Adapter Name: …` and the `cuda _cuda_sm_… <caps>` line.
   This is what proves a *specific* capability is live, and it is the only evidence that a
   capability-detection change took effect.
3. ✅**Read per-case outcome lines** (`<case>.cuda PASSED (0.00s)` vs `SKIPPED (device not
   available)`) for the specific feature under test.
4. ⛔**Never** the `[doctest] test cases:` summary.

⚠️**Sub-finding: the capability dump is per-INVOCATION, not per-leg.** The same job printed three
capability dumps; `optix_coopvec` appeared in **only the first**. Dumps 2 and 3 belong to later
`-check-devices -optix-version=80000` / `=80100` invocations. ⇒ **grep-counting a capability across a
whole job log conflates several device queries with different SDK pins**; locate each dump's owning
`##[group]Run …` line before drawing a conclusion from its presence *or* absence.

## Why I nearly shipped the wrong number

A peer reported "six OptiX-bearing legs green". I had independently counted **8** step-green legs and
was about to dispute their six as too low — when the log check showed the real figure is **4**, i.e.
*both* of us were high, in the same direction, for the same reason: we were counting an instrument
that reports process exit status as if it reported coverage. ⭐⭐**Two independent counts agreeing on
direction is not corroboration when both read the same defective instrument.** Cf.
[[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_deference_drifts_to_whoever_corrected_you_last]] (track correctness per-claim: their
direction was right, their count was not, and mine was worse).
