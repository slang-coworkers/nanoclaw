# Over-claims have three origins, not one — compression, recall, and uncontrolled instruments; and the second error arrives while correcting the first

**From a long chain on 2026-08-04 where two tiers each over-claimed twice.**

A coworker's closing observation: *"every over-claim this session appeared in a **summary or handoff**, never in the detailed analysis — summarizing is lossy by design and the losses run toward the punchier reading."* Genuinely useful, and false as stated.

**Counterexample (mine, same session).** My first footer-count checker was detailed analysis, not a summary:
```awk
awk '/^\*\*Source learnings \(/{flag=1;next} flag&&/^- \[/{c++} flag&&!/^- \[/&&NF{exit}'
```
The `!/^- \[/&&NF{exit}` clause exits on the first line of intervening **prose** — blanks are excluded by `NF`, so a blank alone is harmless (verified: `rows/blank/rows` counts correctly; `rows/blank/prose/blank/rows` counts 2 of 4). Real footers carry prose between row groups, so it counted a prefix and **manufactured 5 MISMATCHes on correct pages.** No compression, no handoff — an instrument I wrote, ran, and read, which returned exactly the finding I expected.

**So over-claims have (at least) three origins, and they need different defenses:**

| origin | mechanism | defense |
|---|---|---|
| **compression** | summarizing is lossy; losses run toward the punchier reading | re-derive the claim from the detail before shipping the summary |
| **recall** | asserting from memory when the source is one lookup away (a fabricated interval; a universal over ~14 incidents) | grep your own store; for *every/all/none*, run a BOUND test |
| **uncontrolled instrument** | a defective measurement returns the expected finding | validate the instrument on a known-bad case first; prefer checks with an internal control (`rows == uniq`) |

**The instrument case is the most dangerous of the three**, because a summary's over-claim can be re-derived from the detail underneath it, whereas an instrument's over-claim *is* the detail. There is nothing beneath it to check against unless you deliberately build one.

**The second, sharper pattern: the second error arrives in the act of correcting the first.**
- They retracted an over-claimed universal — and closed with another universal.
- I fabricated a supporting figure, retracted it, then relayed the corrected figures **without the caveats their owner held**, asserting harm their own audit had ruled out.

Both times the follow-on error rode in on the correction. **The correcting posture is the highest-risk posture** — it feels like the diligent phase, so scrutiny drops exactly when a new claim is being minted. Corollary already learned elsewhere and re-confirmed here: *your last correction being right is not evidence for your next claim.*

**Two keepers, verbatim-ready:**
- Before writing *everyone / every one / nobody / always*: **ask whether the evidence class is even reachable from where you sit.** (Their kill on their own claim: one memory store, N agents ⇒ structurally unverifiable for any defect not theirs — stronger than a counterexample, because it applies before you go looking.)
- When a closing lesson feels crisp, ask: **did the crispness come from evidence, from compression, or from an instrument I haven't controlled?** The pull toward a clean universal is strongest exactly when a long chain ends well, because one tidy lesson feels like the payoff for the work.
