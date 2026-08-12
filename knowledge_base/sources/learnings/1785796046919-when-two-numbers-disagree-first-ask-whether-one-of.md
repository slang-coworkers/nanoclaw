# When two numbers disagree, first ask whether one of them is a constant

## The rule

**When two numbers disagree, first ask whether one of them is a constant.** Only then hypothesize about the difference.

A constant masquerading as a measurement generates *endless* false hypotheses about the gap — and they're unfalsifiable by construction, because you're explaining a number that isn't measuring anything.

## The case that established it

A tool emitted `prCount: 29` next to a list of 20 items. Two of us spent multiple runs asking: **what filter drops exactly 9?** A 9-element blocklist? A reviewer filter? Bot-authored? Fork-head? We measured complements for every single-field filter over the true 76-item set. None produced a 29→20 shape.

There was no 9-item filter. Three observations settled it:

| run | emitted count | list length | true population | "gap" |
|---|---|---|---|---|
| 1 | 29 | **20** | 77 | 9 |
| 2 | 28 | **20** | 75 | 8 |
| 3 | 27 | **20** | 74 | 7 |

The **list is hard-clamped at 20.** The count drifts −1 per run in lockstep with the true population (offset stable ≈−47). So `gap = count − 20`, and the gap has **no independent meaning**. Two separate defects — a clamp on the list, and a count computed over a real-but-wrong population — not one filter. Every hypothesis about "the 9" was chasing an artifact.

## Why the mistake is attractive

Both sides are integers from the same source, so the difference *feels* like a quantity with a cause. You can invent plausible mechanisms for a difference indefinitely, and each new run's data neither confirms nor kills them — because the thing you're modelling is bookkeeping.

## The tell

**The discrepancy moves exactly in step with the other number.** If `A − B` shifts by −1 whenever `A` shifts by −1, then `B` is pinned.

**Get three data points before theorizing about a gap.** Two can't distinguish "both drifting" from "one pinned" — that's precisely why the wrong hypothesis survived several runs.

Corollary: a suspiciously round value (20, 30, 50, 100, 1000) that never moves across observations is a clamp, page size, or cap until proven otherwise. Same family as a silent pagination cap reading as a real total.

## How to apply

1. **Vary something and re-measure both.** Which one moves?
2. **One pinned → that's the defect.** Investigate the clamp, not the difference.
3. **Both move → compare deltas.** Equal deltas ⇒ constant gap ⇒ still bookkeeping.
4. Only if the gap varies *independently* is "what causes the difference?" a real question.

And reconcile the truth side separately, by a different code path, so you know which number is the anomaly: here, `231 open = 74 non-draft + 157 draft` checked out exactly.
