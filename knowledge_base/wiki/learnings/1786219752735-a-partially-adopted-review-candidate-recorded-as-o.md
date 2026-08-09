---
title: "A partially-adopted review candidate recorded as one verdict loses the declined half — and that half is what gets re-litigated"
type: learning
topic: agent-ops
source: learnings/1786219752735-a-partially-adopted-review-candidate-recorded-as-o.md
---

# A partially-adopted review candidate recorded as one verdict loses the declined half — and that half is what gets re-litigated

## The failure

Review ledgers compress each candidate to one state: applied / not applied / open. But real candidates
often **bundle a correct observation with an incorrect remedy**. Recording such a candidate as
"Applied" silently asserts the remedy was adopted too.

Observed on shader-slang/slang#12434. Clarity candidate FG004 said:
1. the comment overstates what the source-location fallback buys — **correct**, comment was fixed;
2. therefore drop the `inst->sourceLoc.isValid() ? inst->sourceLoc : findBestSourceLocFromUses(inst)`
   guard — **incorrect**, and the author declined it on measurement.

The ledger row said **"FG004 — Applied."** A later reader seeing "applied" next to candidate text that
recommends dropping the guard can reasonably conclude the guard was dropped, and "restore consistency"
by removing it — reintroducing the exact bug it exists to prevent.

## Why the declined half is the dangerous one

The applied half is visible in the diff; anyone can see it landed. **The declined half leaves no trace
in the code** — only in a conversation that is gone. So the part with no artifact is the part the ledger
is solely responsible for preserving, and it's the part a single-verdict row drops.

Same shape as recording a *refuted* candidate as "applied": both hide that a reviewer was overruled,
and both invite the work to be redone.

## What settled it (and is worth writing into the code)

```
with the guard (committed):   repro.slang:34:25   caret on '=='
guard removed (mutation):     repro.slang:34:30   caret on '?'    ← regression
```

`findBestSourceLocFromUses` walks to a **consumer** first and only then falls back to the instruction's
own loc, so calling it directly reports the enclosing ternary. Reading the helper's source makes the
guard *look* redundant (it does end with `return inst->sourceLoc;`) — which is precisely how the
candidate arose. **The helper's shape suggests redundancy; execution shows otherwise.**

Fix adopted: state the measured columns in the code comment, so the next reader cannot re-derive
"redundant" from the helper's shape alone.

## Rules

- **Record dispositions per claim, not per candidate ID.** `"comment fix applied; guard-removal declined
  on measurement"` — one row, two verdicts.
- **Attach the basis to a declined half.** "Declined" without evidence reads as unaddressed; "declined,
  measured both ways: caret moves 25→30" is durable.
- **When a guard looks redundant from reading its callee, measure before removing it.** Fallback chains
  that end in the same value the caller checks are the classic false-redundancy shape.
- Keep a **do-not-act-on list** in any handoff note for refuted/declined items: a refutation is invisible
  in a candidate list, so the next session sees "open clarity candidates" and helpfully redoes the work.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786219752735-a-partially-adopted-review-candidate-recorded-as-o.md`_
