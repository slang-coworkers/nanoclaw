---
title: "A correction turn is where an unverified number hides: issuing one pre-asserts your own figures were checked"
type: learning
topic: verification
source: learnings/1786125624148-a-correction-turn-is-where-an-unverified-number-hi.md
---

# A correction turn is where an unverified number hides: issuing one pre-asserts your own figures were checked

# The correction turn is the least-audited place to put a number

Measured 2026-08-07 on the `slang-coworkers/nanoclaw#1145` chain, **twice, by
both parties**, in the same exchange.

## The instance

`slang-pr-approver` spent a turn correcting stale figures of mine (`187`→`218`,
`331`→`360`, `402`→`405`, census `12/6`→`54/44`). Inside that same turn it
asserted **"three ledger rows use `OUT_OF_SCOPE:*`"** — from recall. When I asked
for the keys rather than carrying the figure, it enumerated its own `work/`
artifacts across 303 dirs and found the real count was **seven**. Its own
`decision.md` had said **two**. Three numbers, one fact.

⭐⭐⭐ **Issuing a correction pre-asserts that your own numbers were checked.** The
act of correcting someone else's figures is itself a claim to rigour, and it
suppresses the challenge that would have caught the unchecked one. This is the
same shape as [[feedback_a_false_caveat_is_the_least_audited_claim]] — a hedge
reads as rigour, so nobody probes it.

## Why nothing prompted a re-check — the direction matters

The error failed in the direction that **weakened its own argument**: 7 rows
across 3 repos and 3 suffixes is a far stronger case for the missing policy
predicate than 2. ⭐⭐⭐ **An error that costs you rhetorically triggers no
suspicion, because self-interest is the usual smoke detector.** Compare
[[feedback_deference_drifts_to_whoever_corrected_you_last]]: there the
under-audited number came from a corrector's authority; here it came from the
corrector's own posture.

⇒ **Audit the figures in a correction turn HARDER than the ones you are
correcting.**

## The measurement rule that produced the right answer

Its count came from **reading the `reason_code` field**, not from grepping the
token. Two artifacts (#806, #12324) mention `OUT_OF_SCOPE` only in **negative**
reasoning ("no `OUT_OF_SCOPE` predicate fires"), so `grep -rl | wc -l` would have
reported **9**.

✅ **Reproduced independently on my own corpus** (`/workspace/shared/learnings`,
so a different store entirely): **10** files mention `OUT_OF_SCOPE`, **5** of them
in negative constructions. The shape is general, not a quirk of its tree.

⇒ ⭐⭐ **A token census counts MENTIONS; a claim about state needs the FIELD.**
Negations, "no X fires", and quoted rule text all match the token while asserting
the opposite. Same family as
[[feedback_a_count_answers_hits_the_claim_is_always_instances]].

## Attribution: what each edge can actually prove

The `approval_decisions` ledger is **not mounted** in either container and `ncl`
exposes no decisions resource (both of us checked, neither assumed). So the
correct claim is **"7 decisions carry `OUT_OF_SCOPE:*`, per the approver's
enumeration of its own `work/` artifacts"** — *not* "7 ledger rows". Whether each
decision reached the host ledger is unproven from either edge.

✅ **What I could verify, and did:** all **7** `(repo, pr, commit_sha)` triples
resolve against live GitHub with head SHAs matching to 12 chars (nanoclaw #982
`eccce87d8020`, #1007 `a880d58ea510`, #1145 `e42ab3737c1d`; shader-slang.github.io
#204 `0bdbb55b1ccd`, #207 `2d125818e24e`, #208 `c2d57b7ef099`, #209
`33572d20ab05`). That corroborates the **keys** independently; it says nothing
about the **`reason_code`** field, which only its artifacts hold.

⇒ ⭐⭐⭐ **Split a relayed figure into the part you verified and the part you are
carrying on trust, in the same sentence.** Relaying "7 ledger rows" would have
laundered its recall into my measurement and handed the operator a claim neither
of us can support.

## Don't rewrite the audit trail

It left `decision.md` (which said "two") **unedited on purpose** and put the
correction in the memory leaf. Right call: **a decision artifact is the record as
made.** Correcting it in place destroys the evidence that the error occurred, which
is the part that has to survive for the lesson to be checkable later.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786125624148-a-correction-turn-is-where-an-unverified-number-hi.md`_
