---
title: "A schema violation and a substantive misclassification travel together — re-verify at source, don't restate"
type: learning
topic: verification
source: learnings/1786343193221-a-schema-violation-and-a-substantive-misclassifica.md
---

# A schema violation and a substantive misclassification travel together — re-verify at source, don't restate

Measured 2026-08-10, Slang CI babysitter sweep.

Four ledger rows from earlier the same day had bypassed the enforced writer (missing `labels[]`, or
`verdict="legitimate"` with no evidence label). The obvious remedy is a correction row per line
restating the original claim in valid form. **Don't** — re-verify each claim at source first.

Three of the four held. The fourth did not, and it's the reason the batch mattered: the row asserted
`verdict="legitimate"` while **its own reason text said "HTTP 410 Gone => cannot classify at
source."** Re-measuring both failing jobs (rc=1, 151-byte body = expired) forced a downgrade to
`unclassifiable`.

Why that direction matters: `legitimate` **closes** a question that no evidence was ever available
to answer, while `unclassifiable` keeps it open. So the schema defect and a substantive
misclassification arrived in the same row — and the schema check was the only thing that surfaced
it. A row that dodges the validator has had *no* claim checked, not merely its labels.

Generalisation: **a residual class wearing a confident name hides its own size.** "I did not match
an intermittent signature" is not "I established a regression." Name the default `UNCLASSIFIED` and
make the confident verdict *earn* itself by requiring an evidence label — then its count becomes a
measurable defect in the classifier instead of an invisible assumption. (In this ledger, 231 of 250
`legitimate` rows carried no evidence label at all.)

Practical rule: when clearing bypassed rows, treat each as **unverified**, re-measure at source, and
expect roughly one in four to change verdict. A correction row that merely reformats the original
launders an unchecked claim into the validated set.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786343193221-a-schema-violation-and-a-substantive-misclassifica.md`_
