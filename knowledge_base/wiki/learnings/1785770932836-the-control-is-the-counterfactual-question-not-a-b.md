---
title: "The control is the counterfactual question, not a blocklist — proof: one token, both signs, uninformative each way"
type: learning
topic: misc
source: learnings/1785770932836-the-control-is-the-counterfactual-question-not-a-b.md
---

# The control is the counterfactual question, not a blocklist — proof: one token, both signs, uninformative each way

Across one debugging chain, nine separate signals looked like evidence but could not have come out differently. The decisive case is the ninth, because it inverts the sign of the first — and that inversion is what proves the control must be a **question you ask**, not a **list of patterns you avoid**.

**The same token, cited twice, for opposite conclusions, uninformative both times.** The string was doctest's `DEEPEST SUBCASE: d3d12`:

- **Morning, as a negative.** "Zero occurrences of `DEEPEST SUBCASE: d3d12` ⇒ no d3d12 failures." The count was 0 because that single-line form *never appears* — doctest prints a multi-line `DEEPEST SUBCASE STACK REACHED` header with names on following indented lines. `vulkan` and `cuda` also returned 0. The claim would have "verified" whether or not d3d12 failed.
- **Afternoon, as a positive.** "Absence of `DEEPEST SUBCASE: d3d12` in a green run ⇒ the d3d12 arm is clean." But doctest emits that block *only while logging failures*, so in a 0-failure run its absence is **structurally guaranteed** regardless of the truth.

One string. Opposite signs. Zero information either time.

**Why this kills the blocklist approach.** A maintainer of "patterns that burned us" would have flagged the morning instance and waved the afternoon one straight through — it is the *same pattern* supporting the *opposite* conclusion, and the second use doesn't resemble the first at the level a blocklist matches on. The counterfactual question catches both:

> **Could this have come out differently if my hypothesis were false?**

If the answer is no, you have a tautology wearing the costume of evidence. That question generalizes across sign, across tool, and across the whole family the chain produced:

- a grep whose pattern never matches anything (0 for every case)
- a `$`-anchored pattern against a CRLF log (silently empty)
- `grep -c` of a tool name that only counts `pip install` chatter (topically right, semantically empty)
- a downloaded release artifact standing in for a source build (both A/B arms clean)
- a monitor grepping a file the instant it appears, before content is written (0 = "empty" and 0 = "no repro", indistinguishable)
- a stale symlink predating the build (watch fires regardless of progress)
- `--depth 1` masking a fetch failure as a slow compile
- a line range spanning two constructs ("does it carry the device term?" answered differently depending on where you cut)
- a probe aimed at the wrong observable (comparing *layout* to test a change that only mutates the *capability set* — no difference either way, by construction)

Provenance ("is this primary source?") catches **none** of these. Several were read directly from primary source. Only method catches them.

**Two further shapes from the same chain, both originating one tier up — listed because they are not log-probes, so a reader scanning for grep-shaped mistakes will skip past them:**

- **A wrong premise supporting a right conclusion — the hardest member of the family.** *"`#if` **structurally cannot** take a device term"* is false: a `#if` body can nest a runtime `if` (in-repo precedent — `src/sgl/device/helpers.cpp:64` is `#if SGL_HAS_D3D12` containing a runtime `if (!dxgiDebug)` at `:67`). The conclusion it supported was correct on other grounds, so **nothing downstream looked wrong**, and it cleared three tiers — one of which passed it on explicitly *because the conclusion matched what it already believed*. So the counterfactual question must be asked of the **premise**, not only of the conclusion it happens to support. Two corollaries: **(a)** a correction needs the same evidentiary standard as the claim it replaces — this false absolute was produced *while correcting someone else's overclaim*, reaching for a stronger word to make the correction land; distrust *"structurally cannot," "impossible," "always"* in your own output, especially after *"actually, no."* **(b)** agreement with a prior belief is the condition under which the check gets skipped, not corroboration.
- **A decision whose presupposition cannot be false.** An escalation asked a human *"should we promote the draft?"* when the asker had **already verified no draft existed**. No possible answer applied, so the question carried zero information — and it is worse than a bad log line, because it puts a non-existent decision into a human's queue. **When escalating, re-read the question against the state you just verified and confirm its presupposition holds *now*** — not that it will hold once in-flight work lands.

Both were caught by other tiers, which is the load-bearing organizational fact: **at four separate tiers in one day, the adversarial pass found something in its own author's output** — including one overclaim retracted outright. That hit rate is what makes the self-check structural rather than ceremonial.

**Practical form of the control:**

1. Before believing an absence, run the same probe against a case you *know* is present and confirm it returns non-zero. No positive control, no negative result.
2. Before believing a null A/B, confirm the two arms differ in *some* observable way. Otherwise you cannot distinguish "no effect" from "not testing the effect."
3. Derive the observable from what the mechanism actually mutates. Capability-set change ⇒ check accept/reject and diagnostics; layout change ⇒ check sizes and offsets.
4. When arithmetic is available, use it as an independent check: "33 failures = 28 diagnostics + 5 known-unrelated" falsified a monitor that reported 0 diagnostics. Arithmetic caught what the tooling built to catch it did not.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785770932836-the-control-is-the-counterfactual-question-not-a-b.md`_
