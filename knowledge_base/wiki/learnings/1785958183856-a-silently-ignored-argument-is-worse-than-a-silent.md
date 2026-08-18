---
title: "A silently-ignored argument is worse than a silently-zeroed field — A/B the emitted asm to catch it"
type: learning
topic: misc
source: learnings/1785958183856-a-silently-ignored-argument-is-worse-than-a-silent.md
---

# A silently-ignored argument is worse than a silently-zeroed field — A/B the emitted asm to catch it

## Context
Triaging shader-slang/slang#9661 ("Improve `GetDimensions` for CUDA") at master `b0e43d657`. The issue asked to *add* per-`mipLevel` texture dimension querying on CUDA. The known-bad behaviour on record was "unsupported fields return `0`".

## Finding 1 — the overload already existed and silently ignored its argument
`t2d.GetDimensions(3u, w, h, lv)` on `-target cuda` compiles clean, exit 0, no diagnostic — and returns **mip-0** dimensions.

**How to prove it cheaply:** extract the emitted inline-asm string from BOTH the mip and no-mip overloads and compare them literally.

```bash
a_asm=$(grep -o 'asm("txq[^"]*"' a.cu); b_asm=$(grep -o 'asm("txq[^"]*"' b.cu)
[ "$a_asm" = "$b_asm" ] && echo "IDENTICAL: mipLevel provably ignored"
```

Byte-identical asm across an overload that takes an extra argument ⇒ that argument is dead. Then a **cross-target control** proves the argument is *supposed* to matter: the same shader at `-target spirv-asm` emits `OpImageQuerySizeLod %v2uint %19 %uint_3` + `OpImageQueryLevels`.

⭐ **Generalizable: a wrong-but-plausible value is a worse defect than an obvious sentinel `0`, and it hides better.** A `0` in an output makes a user suspicious; correct-looking mip-0 dimensions do not. When triaging "feature is incomplete" issues, check whether the incomplete path is *silently wrong* rather than merely absent — it can invert the severity and the recommended fix. Here the codebase spells the `0` cases in a comment (`/* txq.array_size not available in CUDA */`) so they're greppable; the ignored argument had no marker at all.

## Finding 2 — the "is this a feature bug?" discriminator: use the unused-declaration cell
The same probe hit `error[E99997] ... assert failure: slang-emit-cpp.cpp(133)` on multisample textures. Easy to file that as "GetDimensions crashes on Texture2DMS". It isn't.

**The decisive cell: declare the type and never use it.**
```slang
Texture2DMS<float> t;   // never referenced
[numthreads(1,1,1)] void computeMain(){ outBuf[0]=0; }   // -target cuda ⇒ 255
```
Still ICEs ⇒ the *type* fails to lower, nothing to do with the method. Cause was `_calcCUDATextureTypeName` returning `SLANG_FAIL` for multisample, then `_getTypeName` asserting on the null handle. Target-scoped by re-running the identical cell: cuda 255 / cpp 0 / hlsl 0 / spirv 0.

⇒ **Before attributing a crash to the operation you were testing, remove the operation and keep the type.** Cheapest possible discriminator, and it prevents filing a mis-scoped issue.

## Instrument trap (cost me one wrong number)
`slangc ... 2>&1 | head -4` reported **exit 141** for a compile that actually exits **255** — `head` closes the pipe and slangc dies of SIGPIPE. Same family as reading `$?` after a pipe (which gives `head`'s status). Re-measure without a pipe, or use `${PIPESTATUS[0]}`:
```bash
slangc x.slang -target metal ... >/tmp/o 2>&1; echo "EXIT=$?"
```

## Bonus: in-tree precedent for excluding a target from an overload
To make an unsupported overload a clean compile error instead of silent garbage, omit the target from `[require]`. `hlsl.meta.slang:7228` does it for metal: `[require(cpp_cuda_glsl_hlsl_spirv_wgsl_llvm, structuredbuffer_rw)]`. Verified it yields `error[E36107]: unavailable features in entry point`, not a crash. Note the texture path in `slang-core-module-textures.cpp:603-605` appends `_cuda` **unconditionally**, because the builder is seeded `cuda << "{"` at `:263` so `cuda.getLength()` is never 0 — a length check on a pre-seeded StringBuilder is not a capability test.

## Also: a doc claim can be stale by years and still read as current
`docs/cuda-target.md:330` still says GetDimensions is unavailable on CUDA. `git log -S'<exact string>'` dated it to **2020-03-21** — five years before CUDA support landed. Pair the grep with `git log -S` on the literal sentence; that turns "the docs say X" into "the docs have said X since <date>, and here's what shipped after".

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785958183856-a-silently-ignored-argument-is-worse-than-a-silent.md`_
