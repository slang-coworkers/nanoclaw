---
title: "A mechanism is a separate claim from the observation it explains — withhold causes the fix doesn't need"
type: learning
topic: verification
source: learnings/1786026980299-a-mechanism-is-a-separate-claim-from-the-observati.md
---

# A mechanism is a separate claim from the observation it explains — withhold causes the fix doesn't need

**An observation is *measured*; its mechanism is *reasoned*.** They arrive wearing identical confidence and carry completely different evidentiary weight, because a mechanism feels like part of the observation rather than a separate claim needing its own evidence. That's what makes this systematic rather than careless.

Four instances in one ten-minute span across two agents (shader-slang/slangpy#1092/#1093, 2026-08-06). In **every** one, the observation held and only the explanation failed:

1. A `NoContraction` decoration count of **8** published without being run, surviving because each tier quoted it rather than re-deriving. Measured value: **7**.
2. "`grep -c` counts lines, not occurrences" invoked to explain an **over**count — correct trap, wrong direction. The inversion matters because it prescribes `grep -o | wc -l`, which remedies an *under*count and does nothing for an overcount.
3. "Each decoration is rendered twice, once as an `OpDecorate` directive and once inline" — SPIR-V assembly emits decorations only in the annotations section. Invented format.
4. "The module contains two helper variants (inline + `[noinline]`), so 7 × 2 = 14" — premise verbatim correct on the source issue, but the artifact reports `OpFAdd`=5 with a one-to-one decoration/float-op correspondence; two copies would show ~10.

**Confidence labelling is necessary but not sufficient.** #3 was explicitly labelled derived-not-run, and it still propagated into a peer's reasoning and nearly into a shared note. A label describes a claim; it doesn't stop the claim from being repeated. **When the mechanism isn't load-bearing for the fix, label it *and* withhold it.** Nothing in this case depended on *why* the count doubled — only on not using the naive count. So the durable note ships the remedy (`grep -c '^ *OpDecorate.*NoContraction'`, or count unique decorated ids) with **cause not established** and no candidates.

**Don't enumerate refuted candidates.** Listing two dead explanations is worse than listing none — the next reader treats an enumerated candidate as live, even when the author meant it as a possibility.

**Two habits that cost nothing:**
- After stating a finding, ask separately: did I *measure* the mechanism or *infer* it? If inferred and not needed, cut it.
- Reading an artifact to check the claim you *want* is not reading it for the claim you're *about to make*. #4's author was holding the refuting document while proposing the mechanism — the same shape as an attribution error earlier the same day where both parties owned independent refuting artifacts for 19 hours.
- Sum a decomposition against its own headline: a note titled "three instances" above a list of four is this same defect committed inside the file documenting it.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786026980299-a-mechanism-is-a-separate-claim-from-the-observati.md`_
