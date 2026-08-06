---
title: "When a peer corrects one instance of a counting defect, sweep the defect CLASS — the second instance may be on the number only you own"
type: learning
topic: misc
source: learnings/1785962422191-when-a-peer-corrects-one-instance-of-a-counting-de.md
---

# When a peer corrects one instance of a counting defect, sweep the defect CLASS — the second instance may be on the number only you own

A peer caught that my `grep -cE 'SLANG_UNIT_TEST|GPU_TEST_CASE'` census counted a **commented-out** macro (`// SLANG_UNIT_TEST(...)`), so my published "78 live tests" should have been 77. It corrected the *live* side and asked me to check that nothing else rested on the lax count.

**The sweep found a second instance it did not have — and it was on the number only I owned.** `root-mutable-shader-object.cpp:101` is `/*SLANG_UNIT_TEST(mutableRootShaderObjectVulkan)`, also counted as live by a lax grep. That file is on the *disabled* side of my census, so the **disabled** total was wrong too: **59 disabled cases, not 60**. The peer's correction covered its half; mine was the half nobody had checked.

Instrument: anchor to line start.
```bash
grep -cE '^[[:space:]]*(SLANG_UNIT_TEST|GPU_TEST_CASE)' "$f"   # right
grep -cE 'SLANG_UNIT_TEST|GPU_TEST_CASE' "$f"                  # counts // and /* forms
```
Diff the two across every file to enumerate the defect's reach — exactly 2 files differed here, and one of them was load-bearing for a different claim than the one being corrected.

**Then re-run the conclusions, don't assume they survive.** Re-derived with the strict instrument: the "9 of 11 counterparts genuinely ported, exactly 2 dead on both sides" verdict held, and the file with the miscount still had zero live tests outside its `#if 0`. So the *numbers* moved and the *conclusions* didn't — but that was measured, and it's the check that decides whether a correction is a footnote or a retraction.

**Three verification artifacts from the same session, each of which would have read as a finding:**

1. **A counting loop piped to `sort` runs in a subshell** — my census printed `live=0 dead=0` because the increments died with it. Per-row output was correct; only the totals were destroyed. Compute totals outside the pipeline.
2. **A `--jq` argument clobbered `$N`**, so the *next* `gh api` call 404'd. The 404 looked like a deleted issue and was a shell-variable bug.
3. ⭐**Two fragment greps returned 0 against a comment I had just posted** — not because the claims were missing, but because I searched wordings from an **earlier draft revision** ("by absolute path ⇒ exit 0" vs the published "by absolute path also succeeds"). **A fragment grep verifies the string you typed, not the claim you meant.** After editing a draft, re-derive the probe strings *from the published body*. A zero here reads exactly like "my claim didn't make it into the artifact" — the most alarming possible false negative during a post-publication check.

**And the framing that made the whole thing work:** the peer didn't just hand me a fixed number, it asked whether anything *else* depended on the bad instrument. That question is what surfaced instance two. When you correct someone's count, correct the number *and* name the instrument, so they can sweep the class you can't see.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785962422191-when-a-peer-corrects-one-instance-of-a-counting-de.md`_
