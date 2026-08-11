---
name: feedback_a_shrinking_pending_queue_is_not_an_answer
description: "ncl approvals holds PENDING ROWS ONLY — rows are DELETED on approve/reject/expire and --status approved|rejected|expired all return []. So a falling pending count (5 -> 2) is NOT evidence the operator answered; the table cannot distinguish answered from expired from vanished. Any single-state table read as a queue inverts its own signal."
metadata:
  node_type: memory
  type: feedback
  originSessionId: c633bea0-8b7b-4a5e-ac3c-56f9a18f0377
---

# A shrinking pending queue is not an answer — it is an absence with two opposite causes

Measured 2026-08-10 while using pending approval cards as an **operator-attendance discriminator**
(the logic: cards piling up unanswered ⇒ operator away, rather than my specific ask being rejected).

The count had gone **5 → 2** since the prior fire. The available reading — and the one I nearly
published — is *"the operator came back and cleared three."* That would have flipped a standing
escalation's whole premise.

## What the instrument actually is

- `ncl approvals help` states it plainly: *"Rows are deleted after the admin approves/rejects or the
  request expires."* The resource is **in-flight cards**, not a decision log.
- Confirmed by probe: `--status approved`, `--status rejected`, `--status expired`, `--status all`,
  `--status resolved` **all return `[]`**. Control: the bare `list` returns the **2** live rows, so
  the instrument is working — those statuses are unreachable because the rows are gone.

⇒ **Approved, rejected, expired, and never-existed are the SAME observation here: absence.**
A decrease carries no direction. The only load-bearing facts are about the rows that *remain*
(their `created_at` age, and `expires_at` being NULL ⇒ they cannot age out on their own).

## The general shape

⭐⭐⭐**A table that stores exactly one state and deletes on transition cannot be read as a queue.**
Its count falling is consistent with the outcome you want and the outcome you fear, in equal measure.
Before treating a delta in such a table as a signal, ask: **where does a row GO when the thing I care
about happens?** If the answer is "it is deleted", then the delta is uninterpretable and only the
survivors testify.

Same family as the null-instrument rule ([[feedback_a_probe_that_cannot_observe_the_subject_returns_a_confident_value]]):
a source that can only ever emit one value is not evidence. Here it is worse than a null instrument,
because it emits a *changing* number that looks like measurement.

⇒ **Guard:** for attendance/progress questions, key on the **oldest surviving row's age**, which is
monotone and cannot be faked by deletion — not on the count, which is not. Related:
[[feedback_a_stored_claim_re_shipped_as_a_live_finding]].
