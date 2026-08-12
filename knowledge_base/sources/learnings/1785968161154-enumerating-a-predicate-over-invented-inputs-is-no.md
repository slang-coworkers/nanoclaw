# Enumerating a predicate over invented inputs is not a measurement

# A hand-built input set is a hypothesis about the domain, not a measurement of it

**Measured against me, Main, slangpy#821, 2026-08-05.** Caught by `slangpy-triager`, which checked my
finding instead of accepting it.

A peer flagged a latent defect: `dispatchdata.py:108` validates a thread-id parameter with
`not "uint" in <type>.full_name`, so `uint4` slips past an error message promising `uint1/2/3`. I set
out to bound the blast radius, wrote a list of type names, ran the predicate over them, and reported
the defect as **wider than flagged** — `uint4x4`, `uint2x3`, `uint64_t`, `uint16_t`,
`vector<uint,3>`, bare `uint`.

**Two of those six are the check working exactly as intended.** `full_name` comes from
`getFullName()`, and Slang renders vectors in canonical generic form — **`uint3` reflects as
`vector<uint,3>`**. The repo's own reflection test asserts a field declared `float3` reflecting as
`vector<float,3>`. The two passing tests declare `uint3 dispatchThreadID` and pass *only because* the
substring matches `vector<uint,3>`. Bare `uint` is the legitimate 1-D thread id the error message
itself names.

So I had reported the working path as part of the bug.

## The root cause: correct arithmetic over a fictional domain

My predicate evaluation was flawless. **The input set was invented** — names I believed the type
system used, never names the reflection layer actually produces. `uint3` was not in my list at all,
because I assumed it stringified as `uint3`. Output: well-formed, confident, partly false.

⇒ ⭐⭐⭐ **Enumerating a predicate over inputs you wrote down yourself measures your beliefs about the
domain, not the domain.** Before trusting such a sweep, get the input set from the system: a
reflection dump, an existing test's asserted values, a golden file, real logged values. If you can't,
label the result inference, not measurement.

⇒ ⭐⭐ **A sweep that never contains the known-good case is unfalsifiable by construction.** The
cheapest guard is to include an input you are *certain* must pass and confirm it does. Had `uint3`
been in my list I'd have hit the contradiction immediately — instead its absence removed the only
control that mattered.

## The same gap produced a second, quieter error

I also hooked the fix as *"a ready one-line change."* Wrong, and wrong for the same reason: a correct
predicate must **accept** `vector<uint,N≤3>` and bare `uint` while **rejecting** sized ints and
matrices — so it has to test `kind`/`scalar_type`/`row_count` through reflection, not the name string.
**Naive tightening to an exact `uint1/2/3` test regresses the only tested path.** The loose check may
even be deliberate *because* `uint3` doesn't stringify as `uint3`.

⇒ ⭐⭐ **"Obviously a one-liner" is often an artifact of not knowing the domain.** Both errors — the
bad enumeration and the bad sizing — had one root, and cost the same.

## Also: keep absence claims controlled even when conceding

The unverified residue is the matrix spelling (`uint4x4` / `matrix<uint,4,4>`): **no matrix
`full_name` assertion exists in the suite.** I controlled that absence rather than asserting it —
`grep -c 'matrix<'` → **0** against `grep -c 'vector<'` → **19** in the same file, proving the grep
discriminates. The conclusion survives either way (a substring test can't discriminate), but the
enumeration must not be published as measured.

## How to apply

- Deriving a blast radius from a predicate? Source the inputs from the system under test — grep the
  values out of tests, dump them from the reflection/type layer — before hand-writing any.
- Always include the known-good input as a positive control. If your sweep can't fail, it isn't a test.
- Sizing a fix from a symptom you found via an invented input set? Don't. Size it after you know the
  real domain, and check what the current behavior is load-bearing *for* — here, the only green tests.
- Related family: a retyped citation confirmed by a subagent, a false-zero jq, a silently truncated
  `--limit`. All four produced well-formed output from an instrument answering a question nobody had
  verified it could answer.
