---
title: "[approver/critique-mustfix] OUTPUT_REVIEW can't verify a ledger row you describe in prose — materialize the exact payload"
type: learning
topic: review-approval
source: learnings/1785935912181-approver-critique-mustfix-output-review-can-t-veri.md
---

# [approver/critique-mustfix] OUTPUT_REVIEW can't verify a ledger row you describe in prose — materialize the exact payload

# [approver/critique-mustfix] Show the payload, not a summary of the payload

**Symptom.** OUTPUT_REVIEW returned must-fix on an otherwise-approved BLOCK decision
(slangpy#1090). Not for a factual error — for an *unverifiable* deliverable. My ledger
section listed the scalars but wrote the two large fields as prose:

    clauses     clauses.json verbatim: 6/6 pass, 0 fail, 0 unevaluable
    challenger  structured object: corrected root cause, 4-leg evidence, ...

The reviewer's objection: that prevents OUTPUT_REVIEW from checking the payload that
will actually be recorded. "Verbatim" is a promise about bytes the reviewer cannot see.
The whole point of the gate is that the recorded row was reviewed — a description of
the row defeats it, and it's exactly where a refuted claim could survive into the
ledger unnoticed.

**Fix that satisfied it.** Materialize the payload as a file and attest to it:

    python3 - <<'PY'   # build the real dict, dump it
    payload = {..., "clauses": json.loads(open('clauses.json').read()), "challenger": {...}}
    open('tmp/record-payload.json','w').write(json.dumps(payload, indent=2))
    PY

Then point the deliverable at `tmp/record-payload.json` and state plainly that the
values passed to `record_decision` are byte-identical to that file, naming the one
exception (`ts`, stamped at call time — it cannot be pre-committed). Verify with
`sha256sum` that the file the reviewer attested is the file you recorded from; codex's
`### Attested` block lists the hash, so comparing is one command.

**Why this is the right shape anyway.** Building the payload as data before the gate,
rather than assembling the tool call afterward, means the reviewed artifact *is* the
recorded artifact. It also caught a second thing for free: with the `challenger` object
laid out in full, it was easy to confirm the withdrawn root-cause hypothesis appeared
only under a `withdrawn_hypothesis` key and not as a live claim.

**Also worth knowing about the gate mechanics.** `mcp__codex__codex-reply` does **not**
carry `developer-instructions`, so a stage re-review sent as a reply is *not recorded*
— the hook rejects it ("developer-instructions do not match the canonical reviewer
block") and the stage still counts as missing. Continuation replies are fine for
iterating within an already-recorded stage, but each stage needs at least one fresh
`mcp__codex__codex` call carrying the canonical block verbatim. Budget for that: a
BLOCK/WOULD_APPROVE decision needs DECISION_REVIEW **and** OUTPUT_REVIEW, and
OUTPUT_REVIEW additionally must end on `approve`, not merely have a round recorded.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785935912181-approver-critique-mustfix-output-review-can-t-veri.md`_
