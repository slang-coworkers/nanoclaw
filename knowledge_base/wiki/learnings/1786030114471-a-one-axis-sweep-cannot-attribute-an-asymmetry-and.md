---
title: "A one-axis sweep cannot attribute an asymmetry, and a fresh instrument defect is a magnet for false blame"
type: learning
topic: misc
source: learnings/1786030114471-a-one-axis-sweep-cannot-attribute-an-asymmetry-and.md
---

# A one-axis sweep cannot attribute an asymmetry, and a fresh instrument defect is a magnet for false blame

Two coupled failures from correcting a slangpy crash triage (#820/#768, 2026-08-06). Both are cheap to avoid and both were caught only by a reviewer.

## 1. Vary the second axis before naming a cause

I ran three attribute-tag arms (`none` / `[CUDAKernel]` / `[shader("compute")]`) against a crash, **all at one backend (CUDA)**, saw `[CUDAKernel]` come back rc=0, and published "the trigger is `[shader("compute")]` specifically, not entry-point tagging in general." I even published that the issue's own title was therefore only "half-true".

The 3×2 matrix refuted it: `[CUDAKernel]` **segfaults on Vulkan**, at the same fault site. **3 of 4 tagged cells crash — the cell I sampled was the lone exception.** The honest unit was a 2-D interaction, not a property of the tag.

Why it slips through: a single-axis sweep *looks* rigorous (one variable, controls passing), and the resulting claim is **narrower** than the truth — narrowing feels like rigor, so nothing prompts a re-check. It reached a fix sketch addressed to the assignee ("scope the fix to `[shader("compute")]`"), which would have shipped a fix missing half the defect.

Rule: before attributing an asymmetry to the axis you varied, name the axes you held fixed and ask whether the result is a property of *that setting*. Publish the cell you measured ("clean on CUDA"), not the rule you inferred ("clean").

## 2. Test a newly-found instrument defect against the anomaly before crediting it

While rebuilding the harness I found a real defect: `[CUDAKernel]` **rejects a non-void return** (`error[E31213]`), so a return-value body isn't legal under both tags and makes the arms structurally incomparable. Tempting and tidy: "that's how the bogus rc=0 arose."

Wrong — **the anomaly survives the fix.** With the corrected `void` + `out` body, CUDA + `[CUDAKernel]` still completes with correct data 3/3. If the anomaly outlives the defect, the defect isn't its cause. Crediting it would have retired a *real* finding as an error: "it was a harness bug" invites closing the question, whereas "it's genuinely target-dependent" is a live discriminator a maintainer wants (an asymmetry like that usually indicates which target's legalization path reaches the bad shape).

## 3. Harness traps that manufacture a silent false "clean" (slangpy specifically)

Each of these produces no crash, for reasons unrelated to the thing under test:
- **Bare `spy.Device(type=...)` omits slangpy's own shader include path** → dies at `load_module("slangpy")` with `error[E00001]: cannot open file 'slangpy.slang'`. This hit **all six of my cells** on the first run. A single-cell probe would have read the absent segfault as "clean". Use `spy.create_device(...)`.
- **`defer_target_compilation` is a `Module.load_from_file` option, not a call kwarg.** As a kwarg it resolves as a phantom parameter and fails before any codegen. (It defaults to `True`, and deferral makes the log print `Dispatching…` before the deferred compile faults — a log line is not a program counter.)
- **`[CUDAKernel]` rejects non-void returns** (`error[E31213]`).

Therefore: **a cell that "didn't crash" means nothing unless a control in the same run produced correct data.** Assert the data, not the exit code.

## 4. A relayed correction can itself be inverted

The correction that prompted all this arrived as: "`[CUDAKernel]` crashes on hlsl and spirv, clean on cuda; the real crash site is `slang-ir-legalize-varying-params.cpp:433-436`; the upstream issue's body cites a wrong file:line." Reading the upstream issue directly:
- **Inverted.** Its per-target table is the `[shader("compute")]` arm (rc=139 on cuda+spirv+hlsl). `[CUDAKernel]` is the clean control, measured **CUDA-only**, explicitly unmeasured elsewhere. The hlsl/spirv `[CUDAKernel]` datapoints never existed.
- **`legalize-varying-params.cpp` appears nowhere in the issue.** It *is* a real unguarded `->getLayout()` hazard, but its enclosing `processEntryPoint` has only CUDA and CPU subclasses (spirv routes via `slang-ir-glsl-legalize.cpp`, hlsl hits `default: break`) — so it **cannot** explain a crash reported on hlsl/spirv. Citing it would have published a fresh error.
- The cited `:466` was **correct**; only the body's *mechanism prose* was wrong, and that had been self-corrected on the issue within 7 minutes. The caution was stale.

For a relayed measurement ask "which arm, which targets, and which were merely *unmeasured*?" — inversions survive relay because both versions name the same tags and rc values. For a relayed `file:line`, check **reachability** on the reported target, not just whether the code looks like a plausible fault.

## 5. Shared bot identity: read every newer comment, not just the ones you were told about

Under a shared GitHub bot identity, the newest comments on the issue were a **sibling session's** work I had no memory of — including one that turned the retracted claim into scoping advice for the assignee. That was the highest-consequence carrier and it wasn't in my assignment. Enumerate all bot comments newer than yours before correcting, and **post fresh rather than editing** when the correction carries an action item: GitHub notifies on create, never on edit.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786030114471-a-one-axis-sweep-cannot-attribute-an-asymmetry-and.md`_
