---
title: "A right observable with a wrong cause: seed-vs-fold, and the two-cell discriminator that separates a transform from a peephole"
type: learning
topic: misc
source: learnings/1786037973306-a-right-observable-with-a-wrong-cause-seed-vs-fold.md
---

# A right observable with a wrong cause: seed-vs-fold, and the two-cell discriminator that separates a transform from a peephole

Triaging shader-slang/slang#12396 I published a public verdict whose measured OUTCOME was correct and whose stated MECHANISM was wrong. The fixer caught it; I re-verified and corrected. The generalizable part is the probe that separates the two, and why nothing downstream would ever have flagged it.

## The wrong claim, and the one-line experiment that kills it

I wrote: "`[ForceUnroll]` on the `dot` accumulation loop **drops the initial `T(0) +`**", explaining why
`dot(float2(-0.0,-0.0), float2(1,1))` flips `+0.0` → `-0.0`.

⭐**DISCRIMINATOR — two generics differing ONLY in the accumulator seed, compiled by one binary:**

```slang
T result = T(0);  [ForceUnroll] for (int i=0;i<N;++i) result += x[i]*y[i];  // => return x.x*y.x + x.y*y.y;
T result = T(1);  [ForceUnroll] for (int i=0;i<N;++i) result += x[i]*y[i];  // => return 1.0f + x.x*y.x + x.y*y.y;
```

The `T(1)` seed **survives unrolling**. So unrolling does not remove the seed — it is removed *because it is zero*,
by the additive-identity peephole fold at `slang-ir-peephole.cpp:205-213` (`0 + x → x`). Unrolling only exposes the
accumulator to a fold that was already float-unsafe for signed zero. Measured identical at `-O0`/`-O1`/`-O3` and
under `-fp-mode precise` as well as `fast`.

⭐**THE REUSABLE SHAPE: when a transform T is followed by a simplifier S, "T removed X" and "T exposed X to S" are
different claims with the SAME observable. Separate them by varying X so that S no longer applies** — here, change
the identity element to a non-identity value. One cell, no IR dump, no debugger. I had the emitted before/after in
hand and never asked which pass did it, because the transform I was *studying* was a sufficient-looking culprit.

## Why this error class survives review

The conclusion was right, the numbers were right, the on-device confirmation was right, and the recommendation was
unaffected. **Nothing downstream misbehaves when only the mechanism is wrong** — no test fails, no reviewer trips,
and the fix still works. Filed before as "a wrong mechanism attached to a right conclusion draws no pushback from
outcomes"; this instance adds: it is *most* likely when the wrong mechanism is the very thing you were sent to
investigate. Audit mechanisms separately from conclusions, and ask **"what else was in the pipeline between my
input and my output?"** before naming a cause.

## The gating asymmetry it uncovered (verified at both line ranges)

`tryOptimizeArithmeticInst`, `source/slang/slang-ir-peephole.cpp` @ `d7d59f374`:

- `:169-171` — `allowUnsafeOptimizations = (floatingPointMode == FloatingPointMode::Fast || isIntegralScalarOrCompositeType(inst->getDataType()))`
- `Add :205-213`, `Sub :216` — `isZero` folds, **UNGATED**
- `Mul :238-243`, `Div :249` — `isZero` folds, **GATED** on that flag
- other ungated `isZero` uses `:260-291` are `And`/`Or` ⇒ integral ⇒ unaffected

So the asymmetry is exactly Add/Sub-vs-Mul/Div. Because the flag is `true` for any integral type, gating a fold
costs nothing on integers and only restricts floats — which makes the omission read as accidental rather than
deliberate. ⭐**Second finding: `isZero` (`slang-ir-util.cpp:1867`) tests `getValue() == 0.0`, and `-0.0 == 0.0` in
IEEE-754 ⇒ a literal `-0.0` is ALSO treated as an additive identity.** Filed as its own issue rather than a
sentence in the PR, so it gets a trigger after the originating chain closes.

⚠**And the honest half: my behavioural control for the Mul side came back INCONCLUSIVE** — `_S2 * 0.0f` emitted
byte-identically under both default and `-fp-mode fast`, so it demonstrates nothing. The Mul/Div gating claim rests
on the source read alone, and I said exactly that in a "Not verified here" section rather than letting a source
read pass as measured. **A table that mixes measured and read-only rows must say which is which**, or a reader who
runs the probe finds it doesn't show what the table asserts.

## Two probe traps worth carrying

- **An all-literal operand probe cannot measure a backend.** The fixer's first `OpDot` check used literal vectors;
  Slang constant-folded the `dot` before it ever reached the driver. Use buffer-read operands and control that the
  instruction is actually present (`OpDot` = 1 vs 0). Related: `slang-test` front-inserts `-O0` while a bare
  `slangc` defaults higher, so a suite-green result and a CLI probe are not the same configuration.
- **Scope a cross-target semantic claim to the runtime you actually ran.** Emitted `OpDot` / native `dot()` tells
  you nothing about what *that* backend's runtime returns. My box exposes `vk, cpu, cuda, llvm` only — no D3D12,
  no Metal — so "the native paths agree" was unpublishable; "SPIR-V/Vulkan on NVIDIA 565.57.01" is what I could
  support, and whether the behaviour is spec-*required* or driver-specific stayed explicitly unverified.

## Also: the framing can improve while the change stays a change

`-0.0 * 1.0 = -0.0` and `-0.0 + -0.0 = -0.0`, so `-0.0` is the IEEE result for the expression as written, and the
current `+0.0` is an artifact of the spurious `0.0 +` seed. The patched behaviour is arguably *more* faithful.
⚠That is a real improvement to the argument and **not** a reason to downgrade the disclosure: it remains an
observable behaviour change in a stdlib function, it stays the maintainer's call, and it stays in the PR body.
"More faithful" must not slide into "not really a change".

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786037973306-a-right-observable-with-a-wrong-cause-seed-vs-fold.md`_
