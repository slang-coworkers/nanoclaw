# [approver/false-safe] The ledger-gap problem had a purpose-built ungated answer already: record_human_verdict stamps the human outcome onto the EXISTING ABSTAIN row, making the disagreement computable from the ledger without writing a reconstructed WOULD_APPROVE

# [approver/false-safe] Don't choose between two bad options when a third instrument exists

## Symptom

Two false-negatives (`slangpy#918` @`57259b457b4c`, `slangpy#1002` @`34e5df38dddf`) sat
recorded as `ABSTAIN_POLICY` when the procedure, under the policy actually in force, would
have said `WOULD_APPROVE` — and both PRs merged with human `APPROVED` at the exact head
decided. The apparent choice was:

- **Re-record as WOULD_APPROVE** — improves agreement stats, but writes decisions no live
  gate ever produced (and `WOULD_APPROVE` is critique-gated while the original
  `ABSTAIN_*` rows were gate-exempt, so the correction costs more than the error did).
- **Leave a documented gap** — honest, but a peer correctly noted the gap must be
  discoverable **from the ledger itself**, or a future reader computing agreement
  statistics gets a silently wrong denominator. Documenting it only in my own work item
  reproduces the original invisibility one layer up.

**Both options were unnecessary.** `SKILL.md:174-201` already defines the right
instrument:

> `github.pr_merged` … **the merge outcome IS a human verdict — merged ⇒
> APPROVED-equivalent** … call `record_human_verdict` for your decision
> `(repo, pr, commit_sha)`.

`record_human_verdict` stamps the human outcome onto an **existing** decision row. It is
not in the critique-gated set — the Step-4 gate covers `WOULD_APPROVE`/`BLOCK`
*decisions*, not verdict joins. Done for both:

```
Human verdict recorded: shader-slang/slangpy#918@57259b457b4c  = APPROVED
Human verdict recorded: shader-slang/slangpy#1002@34e5df38dddf = APPROVED
```

Now the ledger carries `decision=ABSTAIN_POLICY` **beside** `human_verdict=APPROVED` on
the same row. **The disagreement is computable from the ledger** — no reconstructed
decision, no gate bypassed, no silent denominator, and the historical record still says
exactly what the procedure did at the time.

## Root cause of the framing error

I had built a clean binary (fix the data / document the gap) and was escalating it as a
judgment call. Both branches shared a false premise: that expressing "we abstained but the
human approved" requires *changing the decision*. It doesn't — the schema has a **second
field** for exactly that, and the skill instructs using it on merge events.

Why I missed it: I was reasoning about the `decision` column because that's where the
error lived. The fix lived in a *different column on the same row*. Same shape as the
day's other findings — `ci_green_on_sha` needing a state its enum couldn't express,
`{repo, ref}` unable to say "local-only" — except here **the vocabulary did exist and I
didn't look for it.** A schema gap and a schema you haven't fully read produce identical
symptoms.

Also worth noting: these rows should have been stamped automatically when the PRs merged,
via the `github.pr_merged` routing. They weren't — so either those events didn't route to
my decision sessions for these PRs, or the sessions were gone by then. **The join being
manual here is itself a signal** that the automatic calibration path has a hole, which is
the more general defect and outlives the two rows.

## How to catch it

Before escalating a two-option judgment call, enumerate the instruments:

```bash
grep -n "record_human_verdict\|record_decision\|human_verdict" <skill>/SKILL.md
```

Falsifiers: (1) an ungated mechanism exists for the state you want to express ⇒ the gated
route was never required; (2) the field you're trying to overwrite has a sibling field for
the other party's view ⇒ you're conflating two facts into one column; (3) the schema
already supports the distinction ⇒ it's a reading gap, not a schema gap.

## Fix

- Both rows now carry the disagreement, discoverable from the ledger. The
  `WOULD_APPROVE`-re-record question is **moot** — withdrawn from the operator's queue,
  which also removes a decision they'd have had to make on incomplete grounds.
- **Escalate the real defect instead:** why didn't `github.pr_merged` stamp these
  automatically? That path is the programme's designed calibration join, and two merged
  PRs went unstamped for weeks.
- Standing: after building any outcome-join detector, **stamp what it finds via
  `record_human_verdict`** rather than reporting it in prose. Prose findings don't reach
  whoever computes the statistics.

**Method note:** a peer's objection ("the gap must be discoverable from the ledger, not
just your notes") is what sent me back to the skill, where the answer already was. The
objection didn't argue for either of my options — it named a *requirement* both failed,
and that reframing found the third path. **A well-aimed constraint beats choosing between
the options on the table.**

Siblings: the ABSTAIN-vs-merged join entry; "a correction inherits the ceremony of its
destination"; the ratchet (cheapest output, invisible errors, costliest correction).
