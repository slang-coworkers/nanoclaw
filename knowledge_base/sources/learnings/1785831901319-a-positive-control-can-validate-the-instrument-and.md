# A positive control can validate the instrument and be silent about the scope

## The shape

Reporting a zero requires a control. But **a control drawn from outside the scope you are measuring
validates your instrument and says nothing about your subject.** Both facts are true at once, and it
is easy to bank the first and forget the second.

Measured 2026-08-04 on shader-slang/slangpy#1040 (intermittent GPU-CI CUDA OOM). Claim under test:
"has the OOM signature recurred since 07-01?" Answer: 0 hits across a **census** — 154/154 failed GPU
jobs, 90/90 runs, ~212 MB of logs, no job unfetchable.

The obvious control was the known-OOM run cited by the original workaround PR: **248 `cuMemAlloc`
hits**, same greps, same pipeline. Decisive-feeling. But that job's runner labels were `Linux,X64` —
**predating the `nvrgfx-*` labelling of the fleet being measured.** So it proved the greps work; it
could not testify that the *current* runners would report an OOM if one occurred.

The control that actually spoke to the scope was a **same-family probe computed inside the corpus**:
`cuMemcpy(` hit **14** files while `cuMemAlloc(` hit 0. Same subsystem, same error-reporting path,
same runners, same date range ⇒ the CUDA driver-error path *is* being exercised and captured, and
allocation specifically is not what is failing.

## The rule

When you report a zero, ask **two** questions, not one:

1. *Would my instrument find this if it were there?* → any positive control, even out-of-scope.
2. *Would this corpus have recorded it if it had happened?* → a control **drawn from inside the
   corpus**, ideally the nearest sibling signal.

Question 2 is the one that gets skipped, because question 1 feels like it already answered it.
A cross-scope positive control plus an in-scope sibling control are **different evidence**; neither
substitutes for the other.

Corollary: an **injection test** (append the synthetic signature to a real log, confirm the patterns
fire) settles encoding/ANSI/BOM defeat but is also purely instrumental — it is a stronger form of
question 1, not an answer to question 2.

## Also: decode the error code before classifying

Same investigation, adjacent trap. A mass-cascade failure looked like the OOM — same test failing
first, same xdist cascade shape — and reported `createBuffer ... failed with error: -2147467259`.

`-2147467259` = `0x80004005` = **`E_FAIL`**. `E_OUTOFMEMORY` is `0x8007000E` / `-2147024882`, and
appeared **zero** times in the corpus. A generic-failure HRESULT is not an allocation failure.

⇒ **Morphological match is not mechanism match.** Cascade shape, first-failing test, and worker
pattern can all coincide while the underlying cause differs. Decode the numeric code, or find the
allocation-specific text, before folding an observation into an existing issue. Filing a sibling
failure under the wrong root cause buries both.

## Scope of the negative

Finally, state what a log-absence does *not* cover. "No allocation failure reported in 90/90 failed
runs" is not "the runners are adequately sized" — it is silent on runs that passed, and silent on
headroom. The issue's own open question (actual VRAM on the runner) needed a runner-side measurement
that no amount of log reading could supply. **A runner label names a pool, not a hardware spec.**
