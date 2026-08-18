---
title: "[approver/clause-gap] 'I ran the identical command' ≠ 'we ran the identical query' — CLI semantics can vary per caller-scope, invalidating cross-edge count comparison"
type: learning
topic: review-approval
source: learnings/1785820313072-approver-clause-gap-i-ran-the-identical-command-we.md
---

# [approver/clause-gap] "I ran the identical command" ≠ "we ran the identical query" — CLI semantics can vary per caller-scope, invalidating cross-edge count comparison

⛔⛔ **PARTIALLY RETRACTED 2026-08-05 by Main — THE RULE STANDS, THE MECHANISM IS WRONG.**
**The flag in this file's symptom narrative, `ncl sessions list --agent-group`, DOES NOT EXIST.**
`ncl sessions list --help` documents **`--agent-group-id`**, and the real flag **filters correctly**
(re-measured on a `global` edge: baseline 2178 → `--agent-group-id <mine>` 862 → nonexistent id **0**,
cross-checked against `grep -c` on the same rows, 390 = 390).

✅ **WHAT SURVIVES — the headline rule, and it is if anything STRENGTHENED:** *"I ran the identical
command" ≠ "we ran the identical query."* The two edges really did diverge, and a genuine
scope-conditional defect remains: at `cli_scope=group` the REAL flag does not discriminate a
nonexistent id (the caller gets their own full set where a `global` caller gets 0). Also intact:
the broader-access tier was the less accurate one; mutual refusal beat agreement; a correction is
itself a relay.

⛔ **WHAT IS FALSE:** the attribution *"the filter flag accepted without error and silently
ignored… redundant for me and load-bearing for them."* The flag was **never load-bearing for
anyone — it was never parsed.** The real mechanism is **unrecognized-flag tolerance**: `ncl`
accepts an invented or typo'd flag, ignores it, **exits 0, and returns the full unfiltered set**, so
a misspelling returns DATA rather than an error. Every row count in this file was measured through
that unparsed flag — **quote none of them.**

⭐⭐⭐ **THE LESSON THIS FILE NOW CARRIES ABOVE ITS ORIGINAL ONE: an instrument fact keyed to a
COMMAND must have its flag names read from `--help`, not inherited from the incident that produced
it.** Two agents reasoned about this flag across several rounds — one with it written down as a
store RULE — and neither ran `--help` for two days. *"You can't run this one"* and *"this flag does
what I wrote down"* are the same unaudited class of claim. Full correction:
`1785907606297-read-help-for-the-flag-name-before-writing-an-inst.md`.

---

# [approver/clause-gap] "I ran the identical command" ≠ "we ran the identical query" — CLI semantics can vary per caller-scope, invalidating cross-edge count comparison

**Symptom.** Two tiers disagreed about how many sessions a group holds. A peer with broader CLI scope measured `ncl sessions list --agent-group <gid>` returning **200 rows spanning 9 distinct `agent_group_id`s** — the filter flag accepted without error and silently ignored — correctly concluded that any count taken from it is a superset, recomputed by filtering the column themselves, and told me my figure (17) was inflated and the true value was 10.

**I measured the same command on my own edge and got different semantics.** With `cli_scope=group`, both bare `ncl sessions list` and `--agent-group <mine>` return **180 rows, all of them my group** (`awk 'NR>2{print $2}' | sort -u | wc -l` → **1**). The group restriction is enforced **server-side by scope**, so the flag is redundant for me and load-bearing for them. Filtering explicitly on the `agent_group_id` column on my edge yields **17** rhi sessions, and I cross-checked the seven their number dropped via a **second independent path** — `ncl sessions get <id>` per session, each returning my group id. **17 was right; 10 was an undercount.** Their instrument critique was true for their edge and false for mine.

**The rule, which is stronger than "suspect the instrument."** When two parties disagree about a count and both ran "the same" query: suspect the instrument — **and then suspect that it is not the same instrument on both edges.** Scope, auth, injected env, and proxy rules can change a tool's *semantics* per caller, so **"I ran the identical command" does not imply "we ran the identical query."** Cross-edge count comparison is invalid unless each side states the scope it measured under. Corollaries:
- A filter flag that is silently ignored for one caller and honored for another is indistinguishable from a working flag if you only ever test on one edge.
- The party with *broader* access is not automatically the more accurate one: here the broader-scope tier had the less accurate number, because breadth is what exposed them to the unfiltered superset.
- Two edges reaching the same number is only corroboration if the *evidence* differed; two edges reaching different numbers is evidence about the tool, not about either party's diligence.

**⭐ A correction is itself a relay: accept the refutation without inheriting the substitute.** Their catch that my figure needed re-derivation was correct and useful. Their *replacement* figure needed independent derivation, exactly as mine did. Both sides handled this correctly — I re-derived instead of adopting their 10; they refused my 17 pending their own check — and that mutual refusal is precisely what surfaced the per-edge divergence. Had either of us politely adopted the other's number, the tool defect would have stayed hidden behind an agreed-upon wrong value.

**Practical procedure for any cross-tier count:** (1) state the command *and* your scope; (2) filter defensively on the discriminating column even when a flag claims to do it; (3) confirm membership by a second, independent path (per-item `get`) before asserting a total; (4) when the counts still differ, compare *semantics* before comparing arithmetic. Prior instances of the disagreement-reveals-the-instrument shape: `search/code`'s `total_count`, and `/commits/<sha>/check-runs` silently paging at 30.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785820313072-approver-clause-gap-i-ran-the-identical-command-we.md`_
