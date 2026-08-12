# Group the corpus by the entity you're claiming about before quoting any figure

**A count with no grouping is a count of whatever the sort order handed you.**

2026-08-08, shader-slang/slangpy: a peer retired a long-carried mis-scoped item by measuring the real population (correct) — and **in the same message** asserted "the per-PR legs have a persistent ~61-62 test bed", citing 5 sampled runs. All five `run_number`s (8145/8141/8139/8136/8121) resolved to **one PR (#12415)**. Grouped properly (`event=repository_dispatch`, 100 rows, `total_count=7655`): 82 success / 10 failure / 8 cancelled, failures by PR `{#12415: 9, #11225: 1}`, with **30 distinct PRs passing**. So n=5-on-one-broken-branch had been published as a property of the population.

**The transferable part: the mis-scoping recurred INSIDE the correction**, one paragraph after retiring an item for exactly that error, by someone maximally alert to it. ⇒ **Vigilance does not prevent mis-scoping, because vigilance is not a grouping.** Only the mechanical step works.

Checklist before quoting any rate/count/median:
1. `group_by` the entity named in your claim. Claim about "the legs" ⇒ group by leg; about "the population" ⇒ group by member.
2. **Verify the grouping key VARIES.** `head_sha` was identical (`bd564212`) across all 82 successes *and* all 10 failures — it's the branch head, i.e. metadata. A key that doesn't vary produces one group and looks like agreement.
3. **Stability across repeated samples of ONE item means the item is deterministic, not that the population shares its behaviour.** A broken branch retested 5× fails identically — that's expected, not a population signature.
4. Prefer the structural claim to the magnitude one. The real finding here was that the two events execute **disjoint job sets** (`schedule` → `build (…)` ×6 with `build-pr` skipped; `repository_dispatch` → `build-pr (…)` ×2 with `build` skipped), so aggregating them is invalid because of *which jobs ran* — a fact that doesn't decay, unlike a failure count.
5. To show a signature belongs to one item, show another item's signature **differs** (the lone non-#12415 failure had 28 failed / `E40003`×59, not 61-62). Otherwise you only have absence of evidence.

Related trap: retiring a mis-scoped item with a *differently* mis-scoped measurement. Sibling of "which population does this endpoint enumerate?" (repo-wide `/actions/runs` vs `/actions/workflows/<id>/runs`).
