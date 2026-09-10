---
name: project_slangpy_1040_ci_gpu_oom_peak_vram
description: "Bot-filed root-cause analysis of the intermittent slangpy GPU CI OOM. Assignee szihs DECLINED 2026-08-04; issue now UNOWNED. Primary fix is CI-infra (runner VRAM), not code."
metadata: 
  node_type: memory
  type: project
  title: "slangpy#1040 — CI GPU OOM = peak concurrent VRAM (workers × per-worker high-water)"
  originSessionId: fa2a5394-3823-4780-87fa-cc306bdc4156
---

# slangpy#1040 — CI GPU OOM cascade is peak concurrent VRAM, not a leak

`https://github.com/shader-slang/slangpy/issues/1040` — OPEN, filed 2026-07-01 by `nv-slang-bot[bot]`
(**our fleet**). Was assigned to `szihs`.

## ⚠️ This chain was DARK until 2026-08-04

Filed by us, **zero index row, zero memory file, no owner driving it** for ~5 weeks. Found only
because a webhook landed. This is the same failure mode as #11616 (dark 7wk) and #10918 (unindexed).
The index row is the tripwire — do not remove it.

## Current state (2026-08-04)

1. `jhelferty-nv` (MEMBER) asked szihs: *"Do you intend to work on this issue or should we assign to
   someone else?"* (cmt `5049025766`, 07-22).
2. `szihs` replied: *"I don't intend to work on this @jhelferty-nv . Please feel free to assign to
   someone"* (cmt `5176267166`, 08-04).

⇒ **The issue is now UNOWNED.** That is the state change, not a technical challenge to the diagnosis.
Neither comment disputes any claim in the issue body.

## Provenance — what is MINE-VERIFIED vs. INHERITED

⭐⭐**The issue body is BOT-AUTHORED. Its measurements are INHERITED, not verified by me.** Do not
relay them as established fact upstream or on GitHub without re-measuring. Specifically unverified by
me: the L40S/46GB numbers, the ~5 GB single-worker CUDA figure, the 1284-passed suite run, the
flat-after-warm-up micro-repros of #115/#608/#827, and the claim that `4 × per-worker peak` exceeds
the runner's VRAM.

**MINE-VERIFIED at `main` (2026-08-04), by reading the tree:**

- `tools/ci.py:156` (`unit_test_python`) and `tools/ci.py:164` (`test_examples`) both still append
  `["-n", "auto", "--maxprocesses=4"]` when `args.parallel`. The concurrency premise **holds** — the
  rejected workaround PR #1024 (4→2) was never merged, so nothing has changed here.
- GPU CI jobs run on **self-hosted** runners labelled `nvrgfx-kernelvm-bridge`
  (`ci.yml:57-60`, `ci-latest-slang.yml:38-42`); the perf job uses `nvrgfx-perf-kernelvm-bridge`
  (`ci-benchmark.yml:24-25`). The `ubuntu-latest` / `macos-latest` matrix legs are the non-GPU ones.

**NOT verified by anyone yet — and it is the issue's own stated open question:**

> what VRAM does the nvrgfx CI GPU runner actually have?

Everything in fix option 1 ("right-size the runner") is contingent on that number. Until someone
measures it, "4 full-suite workers OOM by construction" is a **hypothesis**, not a finding.

## Why no fixer was dispatched

- **Fix option 1 (primary) is CI-infra owned, not ours.** Sizing or pinning an internal NVIDIA
  self-hosted GPU runner is not reachable from a code PR. We cannot execute it.
- **Fix option 2 (reduce per-worker peak) is a real code change but UNAUTHORIZED.** Not caching every
  device type + a torch CUDA context per worker for the whole session, or releasing the slang-rhi
  pool between heavy groups, touches shared test infra. No maintainer has asked for it.
- **The obvious third option is already REJECTED.** Lowering `--maxprocesses` is PR #1024, closed
  unmerged as *"a workaround"* at ~2× wall-clock cost. ⛔**Do not re-propose it.** Re-filing a
  maintainer-rejected patch under a new number is how a chain earns distrust.

## ✅ MINE-VERIFIED 2026-08-04: the signature has NOT RECURRED in 5 weeks

Posted as cmt **`5176441320`** (new comment — last commenter was szihs, a human, so hygiene says CREATE
not edit).

**Census, not a sample:** 90 runs / **154/154** failed GPU jobs on `nvrgfx*` since 07-01 (~212 MB;
24 job-level 404s all recovered via the run-level log zip; **0 jobs with no obtainable log**).
**Zero hits** for `cuMemAlloc` / `CUDA_ERROR_OUT_OF_MEMORY` / `out of memory` / `bad_alloc` /
`E_OUTOFMEMORY` / `OUT_OF_DEVICE_MEMORY`, case-insensitive.

⭐⭐**The zero is only evidence because of the controls** — and note that FOUR were needed, of
different kinds:
1. **Positive control (pipeline):** #1024's original run `runs/27044842987/job/80546562316` (06-05)
   → **248** `cuMemAlloc` hits. ⚠️But its labels are `Linux,X64`, PRE-dating `nvrgfx-*` ⇒ it
   validates **the search**, NOT the current fleet. A positive control can be right about the
   instrument and silent about the scope.
2. **Same-family, INSIDE the July+ corpus:** `cuMemcpy(` = **14** files while `cuMemAlloc(` = 0
   ⇒ the CUDA driver-error path IS captured; allocation is not what fails. **This is the control
   that actually speaks to the current fleet.**
3. **Error-code census:** 206× `ILLEGAL_ADDRESS`(700), 15× `NOT_FOUND`(500), 4× `LAUNCH_FAILED`(719);
   code **2 (`OUT_OF_MEMORY`) never appears**. Windows: `E_FAIL` 28 files, `E_OUTOFMEMORY` **0**.
4. **Injection test:** appending synthetic OOM lines to a real log made all patterns fire ⇒ not
   defeated by ANSI/BOM/encoding.

⭐**`-2147467259` = `0x80004005` = `E_FAIL`, NOT `E_OUTOFMEMORY` (`0x8007000E`/`-2147024882`).**
A `createBuffer ... failed` cascade is NOT an allocation failure. Decode the HRESULT before
classifying.

### Nearby signature — SEPARATE, do not merge
Runs `30486961130` / `30488422062` (07-29, branch `dev/slangpy-fixer/carrier-996`): mass xdist
cascade, first failure `test_full_torch_copy` — **the same test that failed first in the June OOM** —
but `Failed to create device!` / `createBuffer ... E_FAIL` on **d3d12**, zero allocation text.
⭐⭐**Morphological match ≠ same mechanism** (same shape as the `[GATE AUDIT]` lesson: *"same symptom
class" ≠ same mechanism*). Plausible sibling resource-exhaustion mode; needs the runner measurement
before folding in.

⭐**Absence in FAILURE logs ≠ adequately-sized runners.** It only means no allocation failure was
reported in 90/90 failed runs. The issue's own open question is still unanswered.

## RESUME

**RESUME = `jhelferty-nv` names a new assignee, OR a maintainer explicitly asks the fleet to take
fix option 2 / to measure the runner VRAM.**

⭐**A reassignment request between two humans is not an authorization for us to self-assign the fix.**
The one contribution that needs no authorization is *measurement* — answering the issue's own open
question — and even that must be a real measurement, not an inference from the runner label.

## Traps

- ⭐⭐**"OOM on a rerun-passes flake" does not by itself distinguish peak-concurrency from a leak.**
  The issue's own discriminator is the *step function vs. climb* shape of the VRAM trace. If you
  re-measure, reproduce that shape — a single OOM observation re-opens nothing.
- ⭐**A runner LABEL is not a hardware spec.** `nvrgfx-kernelvm-bridge` names a pool, not a GPU model
  or a VRAM size. Reading the label tells you nothing about the number the issue is missing.
  (Same shape as the [clone-depth lesson](feedback_shallow_clone_makes_your_head_the_graft_root.md):
  the path/label is not the artifact's identity.)
- ⭐**Recurrence is unmeasured.** Nobody has checked whether the OOM signature has fired since
  07-01. A root-cause issue for a flake that stopped firing is a different priority than a live one.
  Do not assert it is still recurring without a probe.

Related: [#12145 d3d12 flake escalation](project_12145_gbufferrttexgrads_d3d12_access_violation.md)
(the slang-side analog — a CI flake with no fix PR, escalated rather than patched);
[spy#1066 CI paths-ignore](project_slangpy_1066_ci_pathsignore_stuck_checks.md).
