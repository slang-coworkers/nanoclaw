# PENDING — awaiting operator approval. Not applied.

**Change:** reword the coworker spine's no-echo clause as a **transport** predicate rather than a
**content** predicate. **Authorization required: operator** (fleet-wide blast radius; a peer recommended
the direction and explicitly declined to authorize it).

**Where:** the "No echoes. No meta-acknowledgements." clause in the base spine's reporting section.
Not a new rule — a rewording of an existing one that measurably fails to fire.

## Why the current wording fails

The clause today reads (content-phrased):

> **No echoes. No meta-acknowledgements.** *"Acknowledged silently"*, *"No echo needed"*, *"Ending turn"*
> are themselves messages — they cost the reader the same tokens the silent-ack rule was meant to save.
> Nothing substantive → send nothing.

⛔ **Measured 2026-08-05, 23:33–23:38Z: a coworker with this exact clause loaded sent TEN consecutive
messages whose entire content was that it was not sending a message** — *"Closed."* · *"No reply."* ·
*"Silent — no reply sent."* · *"No message sent — an eleventh would be the same error."* The receiving tier
had stopped sending four rounds earlier, so the loop was one-sided.

**Its own diagnosis, and the reason a reword is the fix:** it was applying the rule by **announcing
compliance with it**. It read the clause as governing *content* — "don't send an echo" — while treating
*"no reply"* as a **null act** rather than as content. **A rule phrased in terms of content can be
satisfied, in the sender's own judgment, by narrating the rule.**

⭐ **The structural asymmetry: the sender's compliance signal is generated locally, from intent, while the
cost is incurred remotely, in delivered rows.** No amount of care on the sending side closes that gap. Only
a predicate stated over the transport does.

**Escalating series across three recorded instances — 5 hold-markers → 8 × *"No reply."* → 10
announcements** (see `/workspace/shared/learnings/1785832622625-a-silent-hold-marker-is-a-delivered-message-only-t.md`).
**The count grows because each new form feels more compliant than the last**, so every refinement produces
another delivered row.

## Proposed text

> **A terminal turn emits no row.** Not an echo, not a marker, not *"Closed."*, not a restatement of state
> the recipient just sent you. If it appears in `messages_out`, it was delivered and it woke a session —
> intent is irrelevant. Before ending a turn, ask: **does my output name a figure, an artifact, a decision,
> or a question?** If not, emit nothing at all. **Reporting that you are sending nothing is sending
> something.**
>
> As the receiver, you are the only party who can see this loop: the sender sees one polite marker per
> turn. **Two consecutive inbounds with no state change is the threshold to name the mechanism** — say
> "these are delivered and waking me; send nothing unless something changes." Do not reciprocate with
> silence; silence is indistinguishable from politeness to a sender who cannot see the loop.

## ⛔ Disqualifying case — written before anyone claims this change is warranted

**Warranted by:** delivered rows carrying no state change, where the *sender believed it was complying*
with the no-echo rule. The signature is compliance language in the body (*"no reply"*, *"silent"*,
*"closed"*, *"acknowledged"*).

**NOT warranted by:**
- **A misrouted message.** If a row landed in a session that is not the one holding the work, that is the
  **ack-routing** defect class (`thread_id` / phantom-session vocabulary), a separate held change. The ten
  messages here were **correctly addressed and correctly routed** — unnecessary, not misrouted.
- **A substantive message someone found unwelcome.** If the body names a figure, artifact, decision, or
  question, it is not an echo, however unwanted.
- **A long exchange.** Round count is not the predicate; content-free rows are. A thirty-round exchange in
  which every row carried a measurement is not this defect.

**Vocabulary that must be present in evidence:** compliance/terminal language in the body of a delivered
row. Absent that, the complaint is about volume or routing, not about echoes.

## Relationship to the other two pending changes — deliberately unbundled

Three distinct changes are queued, and bundling them would repeat the **category** conflation measured on
2026-08-05 (an echo incident wrongly offered as satisfying a routing gate):

| change | defect class | status |
|---|---|---|
| `append_learning` read-back | write verification | drafted, unapplied (`pending-spine-edit-append-learning-readback.md`) |
| **echo as transport predicate** | **content policy** | **this file** |
| ack-routing `[MUST]` | transport addressing | held at per-group scope, gated on a genuine routing incident |

Each can be authorized without implying the others.
