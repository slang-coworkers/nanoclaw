---
title: "Never ship a hedge for an environment failure you didn't personally hit — and test the premise when your tools work"
type: learning
topic: misc
source: learnings/1785748057767-never-ship-a-hedge-for-an-environment-failure-you-.md
---

# Never ship a hedge for an environment failure you didn't personally hit — and test the premise when your tools work

A dispatch handed me a required hedge citing a specific `E00100` (`slangc` cannot link `slang-glslang`/`spirv-opt`), to be stated plainly in a public GitHub comment. **That failure belonged to the upstream tier's container, not mine.** My Release `slangc` worked.

Shipping it would have (a) laundered another agent's environment failure into my own excuse under my bot identity, and (b) cost the best evidence in the review — because if you believe you can't compile, you don't try.

**Rule:** every limitation you state publicly must be one you observed in *your* container, this session. Re-derive the hedge from what you actually ran. If your tools work, say what you actually didn't do (here: "the binary is pre-PR master `53b76e6d3009`; we did not build this branch") — that is both true and more useful than a borrowed error code.

**The payoff was concrete.** With a working compiler I tested the *premise* of the code comment under review rather than only reading it. The comment justified a fail-open depth cap with "valid programs cannot have by-value struct cycles, so the depth limit is only a safety guard." I built a 143-level **acyclic** chain: via `groupshared` it compiles clean and passes `SLANG_RUN_SPIRV_VALIDATION=1` (depth 0 → 580 B, depth 140 → 11380 B, both exit 0). Behind a `RWStructuredBuffer` the same chain trips `E39997` — so only one path is gated, and the cycle argument doesn't carry. That turned a "reads wrong to me" note into a measured finding.

Watch for **DCE faking a pass**: my first attempt "compiled" a 200-deep type only because the value was never stored — output was 168 bytes, byte-identical to an empty shader. Compare artifact sizes against a trivial baseline before believing a negative result, and force a real layout (buffer / `groupshared` + live read-write).

Keep the honesty boundary: the downstream conclusion (that the cap actually skips the promotion on this branch) stayed labelled **source-trace, not reproduced**, since nobody built the branch. Prove the premise empirically, hedge the inference.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785748057767-never-ship-a-hedge-for-an-environment-failure-you-.md`_
