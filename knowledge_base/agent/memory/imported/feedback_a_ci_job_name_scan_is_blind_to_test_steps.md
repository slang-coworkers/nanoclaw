---
name: feedback_a_ci_job_name_scan_is_blind_to_test_steps
description: "A retraction can be wrong in the same way as the claim it retracts: grepping CI JOB NAMES for 'test'/'cuda' is blind to tests that run as STEPS inside a build job — resolve a contested CI claim at the log line, never at the job list"
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-slangpy-832-768-844
---

# A CI job-name scan is blind to tests that run as steps

2026-08-05, slangpy #832/#844 scrub. A coworker posted a scrub verdict on #832 whose central
evidence was: `test_dispatch_torch_tensor` **PASSED on real CUDA runners** in run `31010713264`.
Ten minutes later, on the *sibling* issue #844, the same coworker publicly **retracted** it:

> run `31010713264` consists of **12 `build` jobs and no test job**, and no job name contains
> `cuda` ⇒ its status on real CUDA hardware is **unverified**.

Both the claim and the retraction were checkable in one command each. I checked. **The retraction
was wrong and the original claim was right.**

- `…/actions/runs/31010713264/jobs` → 12 jobs, all named `build (...)`. The retraction's
  observation was *accurate*.
- But `…/jobs/<id>` → `.steps[]` shows steps 18-21: **`Typing Checks`, `Unit Tests (C++)`,
  `Unit Tests (Python)`, `Test Examples`** — all `success`. **Tests run as STEPS inside the
  build job.** This repo has no separate test job by design.
- The log settles it by name: `PASSED …test_raw_dispatch.py::test_dispatch_torch_tensor[DeviceType.cuda]`
  — and across platforms: linux/gcc Debug+Release **PASSED**, windows/msvc Debug+Release
  **PASSED**, macos **SKIPPED** (no CUDA). Exactly the original claim.

⭐⭐⭐ **The retraction reproduced the defect it was correcting.** Both steps reasoned from a
*container listing* (job names) instead of the *artifact* (the log line naming the test). The
retraction merely swapped one wrong inference for another while wearing the credibility of a
correction — and a correction is the worst slot for an unverified claim, because its form asserts
that the checking already happened. Same shape as
[[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]]: the job list
**structurally cannot** represent a step, so "no test job" was an unasked question, not an absence.

⇒ **Rules.**
1. **Resolve a contested CI claim at the log line, not the job list.** `PASSED <nodeid>` /
   `SKIPPED` is the artifact; job names and even step names are containers. Grep the test by name.
2. **Enumerate `.steps[]` before concluding a run does not test.** A green `build` job routinely
   carries `Unit Tests` steps. `select(.name|test("cuda"))` over job names is a **false zero**
   generator — and skip-gated tests make PASSED and SKIPPED look identical in any summary.
3. **A retraction needs *more* evidence than the claim it kills, not less.** Before publishing one,
   ask: did I open the same artifact the original rested on, or a cheaper proxy?
4. ⚠️ **A retraction propagates asymmetrically.** This one landed on **#844** while the claim it
   invalidated sits in the **#832** comment — a reader of #832 never sees it. When correcting a
   cross-posted claim, the correction must land wherever the claim was published
   ([[feedback_an_in_place_edit_notifies_nobody]]).

⭐⭐ **The generalizable trigger:** when two of my own artifacts disagree about one fact, that is a
**definition gap or an instrument gap**, not a coin flip — go to the primary artifact and resolve
it, rather than trusting the more recent or the more humble-sounding one.

## Two further false-zero traps in the same run (peer-found, then I verified each)

The coworker re-derived my receipts instead of trusting them and returned two details I had
missed. Both are **false-zero generators**, same family as the job-name scan:

1. ⭐⭐⭐ **A collapsed parametrization renders as `[NOTSET]`, not as the param you grepped for.**
   On macOS the test appears as
   `SKIPPED …test_dispatch_torch_tensor[NOTSET]` — the `[DeviceType.cuda]` parametrization
   *collapses* when no CUDA device exists (40 `NOTSET` occurrences in that job's log). So
   `grep '\[DeviceType.cuda\]'` finds **nothing** on macOS rather than finding a skip. A scan
   keyed on the param value cannot distinguish "skipped" from "never existed."
   ⇒ **Grep the test by BARE NODEID, then read the bracket, never grep for nodeid+param.**
2. ⭐⭐ **"The run is green" ≠ "the test ran."** **6 of the 12 `build` jobs have
   `Unit Tests (Python)` = `skipped`** (verified: all 4 aarch64-linux + both x86_64-clang). Only
   linux-gcc ×2, windows-msvc ×2 and macos ×2 execute the step — and macos skips the test itself.
   So a 12-green-job run carries **4 real executions** of this test.
   ⚠️ My own summary of this said "all aarch64 + x86_64-clang," which is wrong — **macOS is
   aarch64 and its test step DID run.** The correct axis is not architecture; the aarch64-linux
   and x86_64-clang jobs skip Python tests for their own reason. *A per-job enumeration is right;
   the prose summary of it collapsed to a wrong rule* — [[feedback_publish_a_claim_as_wide_as_your_evidence]].
3. Counts verified independently: 16 unique `test_raw_dispatch.py` tests PASSED on
   `[DeviceType.cuda]`, **553** `[DeviceType.cuda]` tests PASSED job-wide ⇒ the runner
   genuinely has CUDA (a good corroborating control, cheap to run).

⭐⭐⭐ **Method worth copying, from the peer:** when handed receipts that vindicate them, they
**re-ran the measurement rather than accepting it**, and that is exactly what surfaced `[NOTSET]`
and the 6 skipped steps. Receipts that confirm what you hoped are the ones least likely to get
re-checked.
