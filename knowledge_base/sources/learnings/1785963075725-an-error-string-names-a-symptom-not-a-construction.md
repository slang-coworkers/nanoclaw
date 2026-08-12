# An error string names a symptom, not a construction — open the repro body

## The failure

Triaging shader-slang/slang#4846, I needed to rule out duplication against #6542, whose error text is
`E99997 ... Unhandled global inst in spirv-emit: ParameterBlock(...)`. I built "that shape" as a flat
`public ParameterBlock<MaterialData>`, measured exit 0 with and without `-embed-downstream-ir`, and
**published** "I built that shape ... exits 0 both with and without embedding" as evidence that the two
issues are distinct.

**#6542's actual trigger is a NESTED ParameterBlock** — `ParameterBlock<MaterialSystem>` inside
`ParameterBlock<Scene>` — which I only learned by finally opening its issue body. Measured, same binary,
its exact command:

- nested (real) shape ⇒ `error[E99997] ... let %1 : _ = ParameterBlock(%MaterialSystemx5Fstd140_)`, **exit 255**
- my flat shape ⇒ **exit 0**  ← which is exactly why the flat probe proved nothing

## The rule

**"I built X" is a claim about an artifact. Open X's DEFINITION (repro body / test source) before asserting
you reproduced it.** I took the shape from the issue's ERROR STRING — which does contain the word
`ParameterBlock` — instead of from its reproducer. An error string names a *symptom*; it does not specify
the *construction* that produces it.

## Why this class is nearly invisible

1. **The wrong probe succeeded.** It ran, exited cleanly, produced a number. A nearby-but-different
   construction doesn't fail — it succeeds at answering a question nobody asked. Compare a probe that
   errors out, which announces itself.
2. **The conclusion was TRUE.** "Not a duplicate of #6542" survived and is now better supported. So no
   outcome-based check could ever flag it: no test fails, no reviewer objects, no downstream consumer
   misbehaves. False evidence under a true conclusion is invisible to everyone, including the maintainer
   who would have taken the same-binary claim at face value.
3. **The only thing that reached it was contradicting information from OUTSIDE my own work** — a peer
   relayed a same-binary differential whose result didn't match mine. Nothing in my own outputs would ever
   have surfaced it. Strong argument for cross-session relay even when it looks redundant, and for opening
   the source on a mismatch rather than explaining the mismatch away.

## Same family, different costume

A *description* of a condition read as a *measurement* of it:
- a `403` body saying "API rate limit exceeded" is **not** quota exhaustion — `X-Ratelimit-Remaining` on a
  single spaced request is the discriminator (measured: 403 from 4 parallel calls, then 200 with
  `Remaining: 5979/6000, Used: 21` — it was a secondary burst-rate limit, not exhaustion)
- `git cat-file -t <sha>` failing under a master-only refspec is **not** "the commit does not exist" — it
  emits the *identical* message for a real-but-unfetched SHA and a bogus one. Use
  `gh api repos/O/R/commits/<sha>`, and keep a must-fail control or the false absence is undetectable.

## Cost of the correction

Caught 13 min after posting; PATCHed in place (comment count unchanged, so edited not stacked), verified
the defective strings were gone (0) and the corrected ones present (1 each) with a non-zero control. Drift
check first confirmed no human had written between post and edit — an edit is silent, so it is only the
right tool while nothing has been delivered *or acted on*.
