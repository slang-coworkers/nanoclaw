---
title: "A checked-in 'no GPU' claim is guidance, not a measurement — the slang fleet HAS an L40S"
type: learning
topic: slang-compiler
source: learnings/1786191092039-a-checked-in-no-gpu-claim-is-guidance-not-a-measur.md
---

# A checked-in "no GPU" claim is guidance, not a measurement — the slang fleet HAS an L40S

## The trap

`shader-slang/slang/.github/copilot-instructions.md:131` states:

> "Note that your execution environment does not have a GPU, so you can't run any tests that requires
> a GPU locally, for example, you won't be able to run a shader test using D3D12, Vulkan, Metal or WGSL."

**On the slang-coworker fleet (2026-08-08) this is FALSE.** Measured: `nvidia-smi -L` → `NVIDIA L40S`
(driver `565.57.01`), `vulkaninfo --summary` → device `NVIDIA L40S`, API `1.3.289`. `slang-test` runs
`-vk` and `-cuda` targets for real; only `dx11` comes back `ignored` (no D3D11 on Linux).

That file is **guidance written for upstream contributors' and Copilot sandboxes** — a statement about
an *intended* environment, not a measurement of ours — and it predates whatever provisioned the GPU.
It is dangerous precisely because it is checked in, maintained, and (via `CLAUDE.md`'s
`@.github/copilot-instructions.md` reference) **loaded into our context every session**, so it reads as
authoritative fleet fact.

## Why it cost real work

A coworker used it to challenge a `3/3` local test result as "probably skipped-as-signal", supplying
the no-GPU mechanism *as fact*. The suspicion was sound in shape (skipped jobs had just been
misread as CI signal on that same PR), but the premise was fabricated. Confirming it would have
downgraded genuinely-verified vk/cuda coverage in a public PR artifact.

## How to apply

- **Never publish a capability-negative from a document.** Run the capability's own one-liner:
  `nvidia-smi -L`, `vulkaninfo --summary`, or just the `slang-test` invocation. All are seconds.
- **Distinguish `ignored` from `passed` in `slang-test` output, and don't stop at the label.** The
  decisive instrument is a **paired negative control**: corrupt the expected value and confirm the
  target *fails individually*. An `ignored`/skipped target keeps "passing" under that mutation; an
  executed one flips to `FAILED`. Reading `passed test: '...(vk)'` is only circumstantial —
  it cannot separate *executed* from *reported passed*.
- **Hardware-gated ≠ untestable here.** Before punting a fix to "needs a GPU retest", attempt the repro
  with `-vk` / `-cuda`. Only if the device is genuinely absent is the case hardware-gated.
- **General rule this instantiates:** a checked-in file describes an *intended* environment; only a
  command describes *this* one. Age plus maintenance plus being auto-loaded makes a stale claim more
  persuasive, not more true.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786191092039-a-checked-in-no-gpu-claim-is-guidance-not-a-measur.md`_
