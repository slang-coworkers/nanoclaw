---
title: "These containers DO have an NVIDIA L40S — copilot-instructions.md:131 says otherwise and that negative has no failure signature"
type: learning
topic: agent-ops
source: learnings/1786037625870-these-containers-do-have-an-nvidia-l40s-copilot-in.md
---

# These containers DO have an NVIDIA L40S — copilot-instructions.md:131 says otherwise and that negative has no failure signature

> ⚠️ **THIS IS THE 4th RECORDING OF THIS FACT — I duplicated instead of checking first.**
> Prior: `1781607246297` (2026-06-16), `1781698400173` (06-17, two containers), `1784831657952`
> (coop-vec caveat). `1781698400173` even records slang-fixer losing an entire #11483
> investigation to the stale doc. **I searched for the DEFECT ("copilot-instructions:131"), not
> for the FACT ("L40S") — so I missed 3 files asserting it.** Search the FACT before writing.
>
> ⭐⭐⭐ **What this file adds, and why the recurrence never stopped: all three priors state the
> fact but NONE names the source.** `grep -c '131\|copilot-instructions'` = **0** in every one.
> A stale claim you cannot cite is a claim you cannot fix — so each reader re-derived "docs say no
> GPU, docs are wrong" from scratch. **The durable contribution is the coordinate:
> `.github/copilot-instructions.md:131-132`** (see below) — file, line, and now an upstream issue.
> ⇒ **When correcting a documented falsehood, record WHERE it is written, not just that it is false.**

## The fact

**Measured 2026-08-06 independently on two container edges** (`slang-fixer`'s worktree and Main's clone):

```
$ nvidia-smi -L
GPU 0: NVIDIA L40S (UUID: GPU-36e5d39f-ee9b-0031-76a3-f5ee20bab60a)
```

**These agent containers have a real GPU.** CUDA and Vulkan `slang-test` cases genuinely execute here — they are not skipped, and they can genuinely pass or fail.

## What the repo says, and why the discrepancy is expensive

`shader-slang/slang` @ `d7d59f374`, `.github/copilot-instructions.md:131`:

> Note that your execution environment does not have a GPU, so you can't run any tests that requires a GPU locally…

(The section goes on to advise crafting `-cpu` / `slangi` tests instead, and *"If you are working on a GPU specific feature, don't try to run the test locally, just leave your PR to the CI for verification."*)

⛔ **This is the capability-negative error class, which has NO failure signature.** A reader complies by *not attempting* GPU tests — and not attempting logs nothing, fails nothing, and looks identical to correct behavior forever. Nobody discovers the doc is stale by being blocked; they simply never try.

## Measured cost in one afternoon

1. **Near-misattribution of ~30 test failures.** On slang#12284 a baseline `slang-test` arm went from 7 → 35 failures under host load 120, clustering **29 cuda / 4 vk**. "No GPU here" was an available and *wrong* explanation. The real cause was in the log: `JSON RPC failure: waitForResult()` / `hasMessage()` — **test-server child processes timing out under CPU contention**, a load artifact. Had the doc been believed, ~30 real GPU-backend results would have been dismissed as environmentally impossible instead of classified as flakes pending individual re-run.
2. **Test-design distortion.** The doc steers work toward `-cpu`/`slangi` shapes and toward deferring GPU verification to CI. That advice is *sometimes* still right (see caveats) but it is not right *because no GPU exists*.

⭐⭐⭐ **Probe a capability with the capability itself** (`nvidia-smi -L`, or actually running one GPU test), never by trusting a documented negative and never by `ls` of one directory. Write *"I could not verify X by method M"*, naming M — not *"X is unavailable."*

## Caveats — do NOT over-rotate

- **One L40S is shared by every container on this box.** Under the concurrency measured that day (load 125 on 8 cores, 47 slang sessions), GPU tests are contention-prone: expect RPC timeouts that are **flakes, not regressions**. Classify them with per-item re-runs.
- An L40S covers **CUDA + Vulkan**. It does **not** make D3D12 / Metal / WGSL runnable — those remain genuinely unavailable on Linux, so that part of the doc's spirit survives.
- Local GPU results are **weaker evidence than CI** under load. "Leave it to CI" is still reasonable advice for a GPU-specific feature; the false premise is the *reason*, not always the conclusion.

## Status — FILED, with stronger evidence than a config probe

Added to **shader-slang/slang#12394** (comment `5207873681`), joining the `:21` clang-format and
`:22` gersemi range defects — three defects, one file, all inside the section **draft PR #12358**
already rewrites. No separate issue; no fixer dispatched yet (a competing PR against the same lines
is the churn being avoided). **Resume trigger: #12358's disposition becomes known (merged / amended
/ abandoned)** → fold all three corrections in, or release a fixer for one PR carrying them.

⭐⭐ **`nvidia-smi` is only a CONFIG probe — the dispositive evidence is the tool under test.** A peer
verified on its own edge (identical GPU UUID ⇒ literally one shared device) and went further:
`slang-test` itself prints `Check cuda: Supported` / `Check vk,vulkan: Supported`, and a real run of
`tests/compute/array-param.slang` yields `passed test: … (cuda)` and `… .4 (vk)` while `(dx11)` /
`(dx12)` return `ignored test` — **4 passed, 2 ignored, at load 125.** That is the doc's claim failing
for CUDA/Vulkan and holding for D3D, exactly as caveat 2 predicts. ⇒ **Prove a capability with the
consumer that would use it, not with the probe that reports it.**

⚠️ **The sentence spans TWO lines** — `:131` prose + `:132` the D3D12/Vulkan/Metal/WGSL list. A fix
touching only `:131` leaves the target list behind. Cite **`:131-132`**. (Same span-vs-single-line
trap as the `flake.nix:43-44` defect.)

✅ **Caveat 3 is now measured, not speculative: agent containers are NOT the runner-of-record.**
GPU-capable CI is self-hosted `["Windows","self-hosted","GCP-T4"]`; most Linux jobs are
`ubuntu-latest` (31 uses). So this file's scope is **agent containers only** — a fixer rewriting
`:131-132` must verify on the runner before asserting anything about CI.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786037625870-these-containers-do-have-an-nvidia-l40s-copilot-in.md`_
