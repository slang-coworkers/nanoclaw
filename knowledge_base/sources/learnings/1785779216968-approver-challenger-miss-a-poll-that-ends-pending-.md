# [approver/challenger-miss] A poll that ends "pending" means "not proven yet", not "does not exist" — both bad audit rows died in the last-poll-to-artifact gap

# "Pending at poll end" is not "absent" — re-probe before committing the artifact

## Symptom

Two approver rows recorded `0/0/0` with docs affirmatively stating no CodeRabbit
signal existed. In both, the review existed *before the doc was written*:

| Row | last poll | review landed | doc written | ledger |
|---|---|---|---|---|
| slangpy#1085 @ `a1da5beac5af` | 15:03:39 (exit 22, pending) | **15:04:52** | 15:06:22 | 15:06:56 |
| slangpy#1063 @ `d4e3df4bc408` | 08:36:53 (exit **20**) | **08:45:47** | 08:48:26 | 08:49:32 |

The #1085 doc claimed CodeRabbit "did not settle … treated as no CodeRabbit
signal" — written 90 seconds after the review it says doesn't exist. 4 🟠 Major
findings were sitting on `pulls/N/comments`.

## Root cause

Two distinct escalations of the same error — reporting a *negative observation*
as a *fact about the present*:

1. **#1085**: harvest exit 22 correctly said "pending, review imminent". The
   ~6-min poll window expired, and "timed out while pending" was then written
   down as "no signal exists". A timeout is a statement about the instant it was
   computed. The workflow even names this ("WAIT + re-harvest"), and the poll
   log shows 12 dutiful iterations — the defect is that the *last* iteration's
   result was treated as durable through the following 2m43s.
2. **#1063**: harvest exit **20** — "genuine skip, none pending". The
   pending-detection didn't even flag CodeRabbit, so there was no imminence
   signal to respect. `PENDING_STATUS_RE` matches on a *pending commit status*;
   if CodeRabbit hasn't posted its status yet, or posts green without a review
   object, exit 20 fires and looks authoritative.

Compounding: because both docs concluded "no review at all", nothing prompted a
manual read of `pulls/N/comments`, which is what saved every other affected row.
The two failure modes multiply — a false absence disables the compensation for
the under-read.

## How to catch it

Before writing any artifact whose content depends on "X was not available",
re-probe X. Cheap, and it closes the whole window. Concretely, for the approver:
re-run the harvest immediately before synthesizing the review doc, not only
inside the poll loop.

Also: never let the *narrative* outrun the evidence. "CodeRabbit status was
pending as of 15:03:39" is true and auditable; "there is no CodeRabbit signal"
is a different, stronger, and in both cases false claim. Write the timestamped
version — it forces the re-probe question on the next reader.

## Fix

- Final re-probe before artifact commit, always.
- Exit 20 is not proof of absence: `status green ≠ harvestable review`, and no
  status yet ≠ no review coming. Absence of a review object is not absence of a
  bot pass.
- Phrase every negative finding with its observation time.

Full audit: `/workspace/agent/audit/AUDIT-2026-08-03-coderabbit-under-read.md`.
Same family as the `1785761747454` "never assert a negative from a summarizing
tool" note.
