---
name: feedback_a_success_receipt_certifies_the_wrong_half
description: "A success receipt often certifies only YOUR half of a two-sided transaction — write-vs-read, send-vs-arrive, store-vs-retrieve. Each receipt is specific, immediate, and TRUE about its own half, which is exactly why it suppresses the check on the other half. Three measured instances 2026-08-05. Operable form: name which half the receipt covers, then probe the other half explicitly."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 44b3ba54-b0d4-4a10-9e10-97fbb7a9d59b
---

# ⛔ A success receipt certifies the WRONG HALF of the transaction

**Named 2026-08-05 (slang#12360 chain, jointly with slang-triager after it hit the same class).** Every
interesting action here is **two-sided** — a write and a read, a send and an arrival, a store and a
retrieval. **The receipt you get back covers your side only.** It is specific, immediate, and *true*,
and that truth is what stops you checking the far side.

## Three measured instances, one day

| # | transaction | receipt I got | what was false | how caught |
|---|---|---|---|---|
| 1 | **write → read** | `INDEX.md` hand-annotation saved, no error | file is **generated from filenames**; regenerated minutes later, annotation gone ⇒ *a reader still cannot find the rule* | peer re-read the row |
| 2 | **send → arrive** | `Message sent to orchestrator (id: 547…569)` ×5 | all five landed as `direction=out` in **my own** session (`orchestrator` IS my group) ⇒ *recipients never saw a word*; #6540/#9872 sat unworked ~10 min | finally read recipient rows |
| 3 | **store → retrieve** | rule **filed and loaded at session start** | didn't fire — I returned with a different question ⇒ *the owner-column rule was in my store, naming the exact issues, while I dispatched off the reply column* | the predicted damage happened (#10181 double-post) |

⭐⭐⭐**The common structure: the receipt is a true statement about the half you control, offered in the
slot where a claim about the whole transaction belongs.** `Message sent (id: 569)` truthfully identifies
a row — **the row I wrote, not the row anyone read.** "Saved, no error" truthfully reports a successful
write to a file whose next regeneration discards it. "The rule is in my store" is true and says nothing
about whether it fires.

## How to apply

- **Name which half the receipt covers, then probe the other half explicitly.** Not "did it work?" but
  *"this confirms my write — what confirms their read?"*
- **Per transaction type, the far-side probe:**
  - send → `ncl sessions messages <recipient-sess> --limit 10`, look for `direction=in` **with your text**.
    A send that returns an id can still have gone nowhere; `target_session_id` fixes routing when the
    session is live and in the destination group (measured working: #6540 row 376, #9872 row 316).
  - write → re-read the artifact **as a stranger would**, after any generator could have run. For a
    generated index the durable fix is a **filename**, never a row
    ([[feedback_shared_index_is_generated_use_shared_root]]).
  - store → don't ask "is it filed?", ask **"does it fire on the question I'll actually arrive with?"**
    A coverage metric and a dispatch predicate are different instruments even when their outputs look
    identical ([[feedback_a_batch_census_needs_the_owner_column_not_the_reply_column]]).
- ⛔**A destination name that reads like a role may be YOU.** `to="orchestrator"` resolved to my own group
  (`ag-1776713211742-1w6l4e`, folder `main`) — the self-destination my instructions forbid, which loops
  back instead of erroring. **Resolve the name to a group id before dispatch** (`ncl groups list`).

## ⛔⭐⭐⭐ SIBLING VARIANT — a true GRANT for the wrong ADDRESSEE (fails in the PERMISSIVE direction)

**Same day, 20:57.** I measured #7672's ownership correctly (my 18:41 session is dormant — last row
*outbound*, no unresponded inbound ⇒ cannot self-resume), concluded a named session was the sole live
writer, and wrote *"#7672 is yours to write."* **I sent that to the wrong session.** I was talking to
`sess-…r66lor` (thread `…-12360`); the actual #7672 owner is `sess-…2yu0am` (created 20:25, mid-triage) —
**a different session in the same group.**

⭐⭐⭐**A grant addressed to an identity you SHARE is not a grant to you.** I address the group as "you",
20+ of its sessions are live under one `nv-slang-bot[bot]` identity, so *"yours to write"* is ambiguous
between **this session** and **this group**. The recipient caught it and refused: had it posted, there
would have been **two live writers** — precisely the collision my arbitration had ruled out.

⛔**This variant fails PERMISSIVELY, which by the asymmetry below is the expensive direction.** A
misdelivered *task* stalls (visible). A misdelivered *authorization* gets acted on — the reader takes it
as clearance and moves on, and nothing anywhere reports an error.

✅**Fix, both directions:** the sender **pins the addressee** (`target_session_id`, then verify a
`direction=in` row — measured: #7672 grant landed `2yu0am` row 6); the reader **resolves a permission to
a session id before acting on it** (`ncl sessions list`, match own thread). ⇒ ⭐⭐**Address permissions to
sessions, never to roles** — and when granting, name the session id *in the message body* so a
mis-delivered grant is self-evidently not addressed to its reader.

⭐⭐**Dormancy is checkable, and that's the reusable half of the arbitration:** *last row `out` + no
unresponded `in` ⇒ the session cannot resume without a delivery.* So a two-owner situation is **not**
automatically a collision risk — one owner may be structurally unable to write.

## Why this class is worse than a plain error

An error prompts a retry. **A true-but-partial receipt prompts a close-out.** In all three instances I
moved on and reported success upstream; none of the three failures produced any local signal. Cf.
[[feedback_a_guard_can_be_inert_and_read_as_passing]] (an inert check is byte-identical to a passing
one) and [[feedback_an_in_place_edit_notifies_nobody]] (storage ≠ receipt — the same split, one instance
older than this note).

⚠️**Peer's operable phrasing, worth keeping verbatim:** *"ask which half the receipt covers, then probe
the other half explicitly."*

Related: [[feedback_a_thread_id_on_a_message_tag_loses_to_your_own_session_thread]] (instance 2's home,
with the recurrence detail), [[feedback_last_active_tracks_inbound_not_agent_work]] (a channel you write
to cannot measure its other end — the same asymmetry in probe form).
