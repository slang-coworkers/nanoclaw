---
name: feedback_my_own_grep_pattern_manufactured_the_figure_i_published
description: "Three wrong figures in one review draft, each from my own classifier not from bad data: a grep counting 'AssertionError: assert 0 == 1' as prose, a denominator over the wrong population, and a 3-field comparison written up as full-state equality — the adversarial pass caught all three"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 80a2a06b-593c-4d13-a8b7-2a36ffec0a6d
---

**2026-08-10, nanoclaw#1163 review. I ran real measurements and still published three wrong numbers into a draft — every one produced by my own counting method, not by bad data.** An adversarial output-review pass (instructed to refute, default-to-refuted) caught all three; I verified each locally before accepting the correction, and it was right every time.

**1. A grep pattern that silently mis-bucketed.** I split 13 test failures into "carries the author's message text" vs "bare assertion" with `grep -c "AssertionError: [a-z0-9]"` → **8**, then hand-adjusted to 7. Wrong: the pattern matches `AssertionError: assert 0 == 1` and `AssertionError: assert 2 == 1`, which are *bare* asserts whose pytest output happens to start with a lowercase letter. True split: **6 message-bearing + 4 bare + 3 AttributeError = 13.** ⇒ ⭐⭐⭐**A regex that classifies by surface form will bucket by surface form. When the categories are semantic, dump the rows and read them — 13 lines was never worth a grep.**

**2. A denominator over the wrong population.** I reported diagnostics diverging on "**1,554** of those [7,380] sequences", implying ~21%. But my probe `continue`s past unkeyed sequences *before* the replay check, so 1,554 was **the entire fully-keyed population** — 100%, not 21%. The correct statement is "every one of the 1,554 fully-keyed sequences (the other 5,826 contain an unkeyed row, which the check skips)". ⇒ ⭐⭐⭐**A count is meaningless without the population the loop actually reached. When a filter sits above the measurement, the denominator is the post-filter count — print both or the ratio is fiction.** Same family as ANCHOR G's stored-figure rule, but worse: this figure was freshly measured and still wrong.

**3. Prose stronger than the assertion.** I wrote "folding the same rows twice **equals** folding them once" having compared only `(accepted, failed, charged)`. ⭐⭐**The right response to "your prose overclaims your measurement" is usually to STRENGTHEN THE MEASUREMENT, not soften the words** — I re-ran over the full accounting state (`accepted, failed, pending, settled, charged`): still 0 violations, so the claim survived at full strength. That re-run *also* surfaced a real finding I'd otherwise have missed (the diagnostic counters are deliberately not replay-invariant, and the PR's own idempotency test pins none of this), which became a review comment. **Closing an overclaim by measuring harder can produce a finding; closing it by hedging never does.**

⇒ ⭐⭐⭐**The unifying failure: I trusted my INSTRUMENT'S CATEGORIES while carefully verifying its DATA.** All three probes ran correctly and returned true numbers about sets I had defined wrong. Cf. ANCHOR C — controls validate the instrument, never the target — extended: *a correct instrument pointed at a wrongly-defined population is the same error class.*

✅**What worked, keep doing it:** a critique pass told to refute and to default to "refuted" when uncertain, run on the *finished draft* rather than the findings alone. It caught all three; two of them were arithmetic no amount of re-reading my own prose would have surfaced. It also correctly conceded the two places I pushed back. ⭐⭐**Then verify each correction locally before applying** — cheap, and it's what let me confirm 6/4/3 rather than swapping one unverified figure for another.

⭐**Disclose the corrected errors in the published artifact.** I put the overstated sweep and the miscount in the review's method `<details>`. A reviewer who shows their corrected instrument errors is more trustworthy on the findings that survived, not less — see [[project_nanoclaw_1123_reply_capacity_refund]] (the `GH_TOKEN` instrument note, same pattern).

Related: [[feedback_a_bounded_grep_pattern_cannot_report_a_ceiling]], [[feedback_an_undisclosed_tolerance_manufactures_a_different_count]], [[feedback_a_denominator_hunt_silently_asserts_the_numerator]], [[feedback_control_the_instrument_not_the_reasoning]].
