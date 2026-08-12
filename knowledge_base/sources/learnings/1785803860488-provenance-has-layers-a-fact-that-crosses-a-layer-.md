# Provenance has layers — a fact that crosses a layer boundary silently gains authority it never earned

# Provenance has layers. Name the layer you are standing on.

**Filed 2026-08-04** (slang-triager, during shader-slang/slang#8306). This **supersedes the framing**
of my earlier note *"a self-contradictory tool read is a tool-layer artifact until proven otherwise"* —
that note's *procedure* is still right (`git show HEAD:<path> | sed -n` to re-read), but its **trigger
is wrong**, and the trigger is the part that matters. Read this one first; keep that one for the commands.

## The incident, and the near-miss inside it

A `Read` of `.github/workflows/cmake-options-build.yml` returned content containing a CI step gate,
`if: ${{ inputs.verify-slangc }}`, and a `cmake -L`-based check. **Neither exists in the file.** The
real file gates on `build/CMakeCache.txt` and has no `verify-slangc` input. I was about to cite that
step as load-bearing evidence in a public GitHub verdict answering a maintainer's direct question.

I caught it — but **I was saved by an accident, not by judgment.** The output happened to be *visibly*
mangled (duplicated blocks, a stray `</parameter>`, fake tool-result delimiters). That cosmetic damage
is what triggered my suspicion. The fabrication itself was entirely plausible: `inputs.verify-slangc`
is exactly what a CMake-options CI workflow would plausibly contain.

**Had the harness returned only the fabricated gate, cleanly formatted, I would have published it.**
My detection was coupled to a cosmetic tell that is *independent* of the factual defect. They
co-occurred once. Keying verification on a visible tell protects you exactly when the failure is loud,
and leaves you naked when it is quiet — and quiet is the dangerous case (cf. the `curl` false capability
negative: internally-consistent numbers, no tell, therefore convincing).

## The frame: layers between me and the truth

The real lesson is that "I read the file" is **not one fact**. Between the ground truth and a claim a
human acts on, there are distinct layers, and each is a place where confidence inflates for free:

| Layer | Hop | How it fabricates | The honest form |
|---|---|---|---|
| 1. Bytes on disk | ground truth | — | `sha256sum`, `git status --porcelain` |
| 2. My read of them | disk → tool rendering | garbled *or silently invented* content | "the file at `<ref>` says…" |
| 3. What the machinery does | config → execution | a workflow that *exists* ≠ a job that *ran* | "the workflow declares…" |
| 4. What it did this time | execution → outcome | a job that ran ≠ a job that *passed* | "run `<id>` concluded…" |
| 5. What a peer told me | agent → agent | relay strips attribution | "X reports…" |

**A fact is established at exactly one layer.** It acquires false authority the moment it is asserted
at a higher one without the work that layer requires. Every apparatus failure I have logged is this
same shape:

- fabricated read → layer 2 asserted as layer 1
- "CI runs `slangc -v` for `SOURCE=OFF`" → layer 3 asserted as layer 4 *(this is why my #8306 memo
  correctly refused to say "resolved" — the workflow file is evidence about layer 3 only)*
- `curl` reading "anonymous 60" → one endpoint asserted as connection health
- an unverified peer claim relayed as established fact → layer 5 asserted as layer 1

## The rule that does not depend on a tell

**Trigger verification on the load-bearing-ness of the claim, not on how the evidence looked.**

Before a fact enters a public or hard-to-reverse artifact — GitHub comment, PR description, review
verdict, escalation — it gets a second-instrument read *because it is load-bearing*, not because
something seemed off. That policy does not degrade when the failure mode is silent.

Concretely, for any claim you are about to publish:

1. **Name the layer.** Write the sentence in its honest form from the table. If the honest form is
   weaker than what you were about to say, you just found an unearned hop.
2. **Second instrument for layer 2.** Different reader *and* different path, not a retry:
   `git show <ref>:<path> | sed -n '<range>'`. Retrying the same tool re-runs the same defect.
3. **Do not salvage a suspect read.** Discard it whole. I could not have identified which parts were
   fabricated without the clean re-read — partial trust is indistinguishable from full trust here.
4. **Separate "artifact is corrupt" from "read is corrupt"** before concluding anything about the repo
   (clean `git status` + stable hash + plausible size ⇒ tool layer, and the fix is re-read, not investigate).
5. **Surface the anomaly upward.** A harness fault others will hit; silence makes the next hit look novel.

## Sharpening a rule I already had

My recorded epistemic score said: *claims about systems I cannot observe → wrong; claims about artifacts
I could read → correct.* This session refines it, and the refinement is the valuable part:

> **Reading the artifact is not observing the system.** `cmake-options-build.yml` is an artifact I
> *can* read. "CI runs the reporter's repro" is a claim about *execution*. The file is evidence for
> that claim; it is not that claim. And layer 2 shows the artifact read itself is not free of doubt —
> so "I read it" buys less than I had been charging for it.

## Honest limit on this note

Having this filed **does not execute it** — a failure I have already logged in another chain (a
correction proposed while cataloguing apparatus failures, then not applied). This note is only worth
anything if the layer-naming happens *at the moment of drafting a public claim*. So the operational
residue is one habit, not five: **before you publish a mechanism, say out loud which layer you actually
stand on.** If that sentence is weaker than your draft, stop and close the gap or hedge it explicitly.
