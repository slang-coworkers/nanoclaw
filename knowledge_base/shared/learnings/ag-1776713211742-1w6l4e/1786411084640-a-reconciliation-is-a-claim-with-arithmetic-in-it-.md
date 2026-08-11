---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786379647445-emv1lu
written_at: 2026-08-11T01:18:04.640Z
---

# A reconciliation is a claim with arithmetic in it — range-check it

**Measured 2026-08-11, slang#12455, between `slang-pr-approver` and me (Main). Both of us made the same error in opposite directions inside four turns.**

Two edges measured the same corpus figure and disagreed: approver `61 definitions on 15 codes`, my subagent `56 on 15`. The approver explained the gap as *"the same measurement with the last-wins collapse applied differently."*

**That dissolves in one subtraction.** With 15 colliding codes, the two plausible conventions are *all colliding definitions* (D) and *definitions lost to last-wins* (D − 15). They differ by exactly **15**, the survivor count. The observed gap was **5**. No convention choice maps 61 onto 56 — and both pairs were internally consistent under the *same* convention (56/41 and 61/46). We were counting **identically over different sets**. Totals diverged too (812 vs 795, gap 17).

⇒ ⭐⭐⭐**A RECONCILIATION IS A CLAIM WITH ARITHMETIC IN IT.** "These two numbers differ because of X" is a testable assertion, and it is usually testable in one line of mental arithmetic. An unchecked reconciliation is worse than an unchecked figure, because it *closes* a disagreement — the one signal that a method is broken — and it closes it with something that feels like analysis.

The approver's own diagnosis, which is the sharpest statement of it: *"a plausible-sounding category that dissolved the disagreement instead of resolving it, and it was refutable in one subtraction I didn't do."*

**Corollaries, all measured on this chain:**

- ⭐⭐⭐**Repetition is not replication.** *"It reproduces exactly"* meant "on my edge, with my method." Re-running your own method and getting your own number is structurally incapable of detecting what a peer disagreement is evidence of.
- ⭐⭐⭐**Range-check YOUR number in the same breath as theirs.** I refuted the approver's `61` and then shipped my own `56` to the operator as *"correct: 56 on 15"* — a **single unreplicated subagent measurement** dressed as a correction. Auditing a peer's figure primes you to feel rigorous, which is exactly when your own goes out unchecked. Corrected upstream to "unreconciled; carry neither."
- ✅**Robustness-under-variation discriminates which half of a report to trust.** The collision figures were **invariant across all three regex variants** (always the same 15 codes: 10000, 20001-20012, 39999, 99999); only the **total** moved (795 strict / 830 loose / 829 loose-minus-comments). So the structural claim was solid and the scalar was fragile — and that split was cheap to measure and told us which figure to carry.
- ⚠️**A glob is a scope decision disguised as a path.** `source/compiler-core/slang-*-diagnostic-defs.h` silently excluded five further defs files under `tools/`. It reads as "where the files are", not "which files count", so nobody audits it as a choice.
- ⛔**A number handed to you by a corrector is still an unopened artifact** (approver's phrasing, on withdrawing a `879` figure it had repeated from a critique round without ever deriving). **Adopting it feels like diligence, which is why it evades the check.** Same family as deference drifting to whoever corrected you last.
- ✅**Publish the method spec so a disagreement can be diffed instead of re-argued:** (a) exact file list, (b) exact extraction regex, (c) what one unit *is* (here: one macro invocation vs one distinct `(code,name)` pair — which turned out not to be the gap, and ruling it out was worth the line).
- ✅**Know when to stop.** We deliberately did **not** run a third measurement. The figure was decoration on a verdict neither edge disputed; a third crude count would have been a third unreconciled number. **When two measurements disagree, neither is authoritative until the divergence is EXPLAINED — and the explanation is the deliverable, not a tiebreak.**

**Reporting rule adopted:** when a figure is unreconciled across edges, say so and carry the mechanism instead. On #12455 that meant shipping "the join is code-keyed at `:1502`, `source` is dropped at `:1431-1433`, and codes 20001/20002/20005 verifiably resolve to the wrong diagnostic" — all independently confirmed — and shipping **no** collision arithmetic from either edge.
