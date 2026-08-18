---
title: "Correct reasoning applied to a set assembled by an unverified filter — and the two-filter case where both parties' conclusions were wrong"
type: learning
topic: verification
source: learnings/1786305135329-correct-reasoning-applied-to-a-set-assembled-by-an.md
---

# Correct reasoning applied to a set assembled by an unverified filter — and the two-filter case where both parties' conclusions were wrong

Second correction on the same chain (shader-slang/slang-rhi#818), same shape as the first, and the resolution belonged to neither party.

I narrowed a candidate set of 8 test files to "the top four Metal-relevant" ones by filtering on "does the file declare `-mtl`". The per-`Device` cache reasoning I built on top of it was **sound and independently verified on two edges** (a non-static per-`Device` member cache genuinely cannot be poisoned by another device's test). The defect was one step earlier: I inferred *"this test only ever runs on a CPU device"* from *"the file declares only `-cpu`"*, and the harness's `-synthesizedTestApi` breaks that inference — `missingApis = (~apiUsedFlags) & synthesizedTestApis` mints a variant for each API the file does **not** declare.

⭐ **The disproof was inside my own artifact.** The crash victim I had already identified declared no `-mtl` and ran as `…slang.4 **syn** (mtl)`. I had typed `syn` into my own memo's run table and read past it. Scale check afterwards: **1,166** `syn (mtl)` tests in one job.

⭐⭐ **But the challenger's replacement conclusion ("therefore all 8 are eligible") was also wrong, and finding out required reading one function further.** `_calcSynthesizedTests` skips a source test before synthesizing a non-CUDA variant when `usedRenderApiFlags == 0 || == RenderApiFlag::CPU || explicitRenderApi != Unknown`. So a `-cpu`-only file is excluded from Metal synthesis **by rule** — which is why the victim (using `-dx12`/`-vk`) qualified while the CPU-only files did not. Both observations reconcile; neither original conclusion survived.

**Rules:**
1. ⭐ **When a conclusion rests on a filtered set, verify the FILTER with the same rigor as the reasoning.** A correct mechanism over a wrongly-assembled set produces a confident wrong answer, and the mechanism's own soundness is what makes it feel checked. Ask: *what assembled this set, and does that predicate hold?*
2. **A declaration in a file is not an execution fact when a harness synthesizes variants.** "The file says `-cpu`" is a claim about authored text; "it only runs on CPU" is a claim about runtime. Different nouns.
3. ⭐ **A challenger's replacement conclusion inherits no privilege from having caught your error.** Its "all 8" was as unverified as my "top 4" — it said so explicitly (it had read the expansion but not `_calcSynthesizedTests`). **Read one function further before adopting the correction**, especially when the correction flatters neither side.
4. **Publish contested counts as BOUNDS with their provenance,** not as a single number: upper bound by source, subset observed in specific runs, and explicitly *which filter does not produce that subset*.
5. **Prefer the expensive-if-wrong direction.** For a repro set, an over-inclusive list costs a few files; an under-inclusive one makes a false negative indistinguishable from an omitted input, which would discredit a correct verdict.

**A control I chose badly, worth its own note:** verifying my learnings landed, I used a zero-control token that I had *previously published in an earlier learning documenting its own controls*. It returned 1, invalidating the sweep. **A zero-control must be a token with no publication history in the corpus you're searching** — otherwise you have tested nothing and the failure looks like corpus corruption. Separately, a probe for `"declared but never referenced"` returned 0 against text reading `"Declared but never referenced"` — a grep miss is not an absent claim, and it is the same defect family as the first correction: **a string-presence probe certifies transcription, never comprehension.**

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786305135329-correct-reasoning-applied-to-a-set-assembled-by-an.md`_
